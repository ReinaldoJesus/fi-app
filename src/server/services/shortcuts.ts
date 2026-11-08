import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ShortcutTransaction } from "@/lib/api/schemas"
import { fmtCurrency } from "@/lib/fmt"
import { badRequest } from "../errors"
import { createTransaction } from "./transactions"
import { getTransactionSuggestions } from "./insights"
import { matchAccount, norm, parseLooseAmount } from "@/lib/wallet"

/**
 * Records a payment sent by the iPhone Shortcuts "Transaction" automation
 * (Apple Pay / Wallet). Wallet gives the amount, the merchant and the card name;
 * we pick the account from the card and the category from past movements of the
 * same merchant, so the person never has to type anything.
 */

export async function recordShortcutTransaction(userId: string, input: z.infer<typeof ShortcutTransaction>) {
  const [accounts, user, hints] = await Promise.all([
    prisma.finAccount.findMany({
      where: { userId, type: { not: "INVESTMENT" } },
      select: { id: true, name: true, bank: true, type: true, currency: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { defaultAccountId: true } }),
    getTransactionSuggestions(userId),
  ])
  if (!accounts.length) throw badRequest("Primero crea una cuenta en Clarifi")

  const account = matchAccount(input.card, accounts)
    ?? accounts.find(a => a.id === user?.defaultAccountId)
    ?? accounts.find(a => a.id === hints.topAccount)
    ?? accounts[0]

  const amount = parseLooseAmount(input.amount, account.currency)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest("No entendí el monto", { amount: ["No entendí el monto"] })
  }

  const merchant = input.merchant?.trim() || undefined
  const m = merchant ? norm(merchant) : ""
  // Same merchant as before → same category; otherwise the one used the most.
  const known = m
    ? hints.suggestions.find(s => s.type === input.type && norm(s.description) === m)
      ?? hints.suggestions.find(s => s.type === input.type && (norm(s.description).includes(m) || m.includes(norm(s.description))))
    : undefined
  const categoryId = known?.categoryId ?? hints.topCategory[input.type] ?? undefined

  const tx = input.dryRun ? { id: null } : await createTransaction(userId, {
    type: input.type,
    amount,
    accountId: account.id,
    categoryId,
    description: merchant,
    notes: input.card ? `Apple Pay · ${input.card}` : "Apple Pay",
  })
  const category = categoryId
    ? await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, name: true } })
    : null

  const parts = [`${fmtCurrency(amount, account.currency)}${merchant ? ` en ${merchant}` : ""}`, category?.name, account.name].filter(Boolean)
  return {
    id: tx.id,
    amount,
    currency: account.currency,
    account: { id: account.id, name: account.name },
    category,
    /** Ready for the Shortcuts "Show notification" action. */
    dryRun: input.dryRun,
    message: input.dryRun ? `Así quedaría: ${parts.join(" · ")}` : `✓ Registrado: ${parts.join(" · ")}`,
  }
}
