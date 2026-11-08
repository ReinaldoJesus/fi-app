import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ShortcutTransaction } from "@/lib/api/schemas"
import { fmtCurrency } from "@/lib/fmt"
import { badRequest } from "../errors"
import { createTransaction } from "./transactions"
import { getTransactionSuggestions } from "./insights"
import { ensureDefaultCategories } from "./categories"
import { matchAccount, norm, parseLooseAmount, parseNotification } from "@/lib/wallet"
import { pickCategory } from "@/lib/merchantCategories"

/**
 * Records a payment sent by the iPhone Shortcuts "Transaction" automation
 * (Apple Pay / Wallet). Wallet gives the amount, the merchant and the card name;
 * we pick the account from the card and the category from past movements of the
 * same merchant, so the person never has to type anything.
 */

export async function recordShortcutTransaction(userId: string, raw: z.infer<typeof ShortcutTransaction>) {
  // Android sends the payment notification as is; fill what the iPhone sends explicitly.
  const fromNotif = raw.title || raw.text ? parseNotification(raw.title, raw.text) : null
  const input = { ...raw, amount: raw.amount ?? fromNotif?.amount, merchant: raw.merchant || fromNotif?.merchant, card: raw.card || fromNotif?.card }
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

  // On Android the notification title is often the bank's app ("Santander"): a hint for the account.
  const account = matchAccount([input.card, fromNotif ? raw.title : undefined].filter(Boolean).join(" ") || undefined, accounts)
    ?? accounts.find(a => a.id === user?.defaultAccountId)
    ?? accounts.find(a => a.id === hints.topAccount)
    ?? accounts[0]

  const amount = input.amount === undefined ? NaN : parseLooseAmount(input.amount, account.currency)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest("No entendí el monto", { amount: ["No entendí el monto"] })
  }

  const merchant = input.merchant?.trim() || undefined
  const m = merchant ? norm(merchant) : ""
  // 1) Same merchant as before → the category they chose (their correction always wins).
  const known = m
    ? hints.suggestions.find(s => s.type === input.type && s.categoryId && norm(s.description) === m)
      ?? hints.suggestions.find(s => s.type === input.type && s.categoryId && (norm(s.description).includes(m) || m.includes(norm(s.description))))
    : undefined
  let categoryId: string | undefined = known?.categoryId ?? undefined
  if (!categoryId) {
    // 2) A known store (Jumbo → Supermercado/Alimentación, Copec → Transporte…).
    // 3) Otherwise "Otros gastos" / "Otros ingresos": never uncategorised, never a random guess.
    await ensureDefaultCategories(userId)
    const cats = await prisma.category.findMany({ where: { userId, type: input.type }, select: { id: true, name: true } })
    categoryId = (input.type === "EXPENSE" ? pickCategory(merchant, cats)?.id : undefined)
      ?? cats.find(c => c.name === "Otros gastos" || c.name === "Otros ingresos")?.id
  }

  const tx = input.dryRun ? { id: null } : await createTransaction(userId, {
    type: input.type,
    amount,
    accountId: account.id,
    categoryId,
    description: merchant,
    notes: `${fromNotif ? "Android" : "Apple Pay"}${input.card ? ` · ${input.card}` : ""}`,
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
