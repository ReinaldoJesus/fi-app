import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ShortcutTransaction } from "@/lib/api/schemas"
import { fmtCurrency } from "@/lib/fmt"
import { badRequest } from "../errors"
import { createTransaction } from "./transactions"
import { getTransactionSuggestions } from "./insights"
import { ensureDefaultCategories } from "./categories"
import { classifyNotification, matchAccount, norm, parseLooseAmount } from "@/lib/wallet"
import { pickCategory } from "@/lib/merchantCategories"

/**
 * Records a movement sent by an automation on the phone:
 *  - iPhone Shortcuts "Transaction" (Apple Pay): amount, merchant and card, explicit.
 *  - Any bank notice as text (Android notification, or an e-mail / SMS forwarded by
 *    an iPhone automation): purchases, transfers in and out, automatic charges.
 *    Promotions, security codes, reminders and balance notices are ignored.
 * The account comes from the card, the category from the person's past choices for
 * that merchant (then a store dictionary), so nobody has to type anything.
 */

/** Label stored in the movement's notes (also how the app recognises automatic ones). */
export const SOURCE_LABEL = { applepay: "Apple Pay", notification: "Android", email: "Correo del banco", sms: "SMS del banco" } as const
/** The same payment can arrive twice (Apple Pay + the bank's e-mail): skip repeats within this window. */
const DUPLICATE_WINDOW_MS = 30 * 60_000

export async function recordShortcutTransaction(userId: string, raw: z.infer<typeof ShortcutTransaction>) {
  const notice = raw.title || raw.text ? classifyNotification(raw.title, raw.text) : null
  if (notice?.kind === "ignore" && raw.amount === undefined) {
    // 200, not an error: the automation did its job, there was just nothing to record.
    return { ignored: true as const, reason: notice.reason, message: `Ignorado: ${notice.reason}` }
  }
  const parsed = notice?.kind === "movement" ? notice : null
  const source = raw.source ?? (notice ? "notification" : "applepay")
  const input = {
    type: raw.type ?? parsed?.type ?? "EXPENSE",
    amount: raw.amount ?? parsed?.amount,
    merchant: raw.merchant || parsed?.description,
    card: raw.card || parsed?.card,
    dryRun: raw.dryRun,
  }

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

  // The notice's title is often the bank's app or sender ("Santander"): a hint for the account.
  const account = matchAccount([input.card, notice ? raw.title : undefined].filter(Boolean).join(" ") || undefined, accounts)
    ?? accounts.find(a => a.id === user?.defaultAccountId)
    ?? accounts.find(a => a.id === hints.topAccount)
    ?? accounts[0]

  const amount = input.amount === undefined ? NaN : parseLooseAmount(input.amount, account.currency)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest("No entendí el monto", { amount: ["No entendí el monto"] })
  }

  if (!input.dryRun) {
    // Only against other automatic movements: a hand-entered one with the same amount is not a repeat.
    const repeat = await prisma.transaction.findFirst({
      where: {
        userId, type: input.type, amount, createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        OR: Object.values(SOURCE_LABEL).map(label => ({ notes: { startsWith: label } })),
      },
      select: { id: true, description: true },
    })
    if (repeat) {
      return { duplicate: true as const, id: repeat.id, message: `Ya estaba registrado: ${fmtCurrency(amount, account.currency)}${repeat.description ? ` · ${repeat.description}` : ""}` }
    }
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
    // 2) A known store (Jumbo → Alimentación, Copec → Transporte…) or salary → Sueldo.
    // 3) Otherwise "Otros gastos" / "Otros ingresos": never uncategorised, never a random guess.
    await ensureDefaultCategories(userId)
    const cats = await prisma.category.findMany({ where: { userId, type: input.type }, select: { id: true, name: true } })
    categoryId = (input.type === "EXPENSE" ? pickCategory(merchant, cats)?.id : undefined)
      ?? (parsed?.salary ? cats.find(c => c.name === "Sueldo")?.id : undefined)
      ?? cats.find(c => c.name === "Otros gastos" || c.name === "Otros ingresos")?.id
  }

  const tx = input.dryRun ? { id: null } : await createTransaction(userId, {
    type: input.type,
    amount,
    accountId: account.id,
    categoryId,
    description: merchant,
    notes: `${SOURCE_LABEL[source]}${input.card ? ` · ${input.card}` : ""}`,
  })
  const category = categoryId
    ? await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, name: true } })
    : null

  const money = `${input.type === "INCOME" ? "+" : ""}${fmtCurrency(amount, account.currency)}`
  const what = merchant ? (/^(transferencia|sueldo)/i.test(merchant) || input.type === "INCOME" ? ` · ${merchant}` : ` en ${merchant}`) : ""
  const parts = [`${money}${what}`, category?.name, account.name].filter(Boolean)
  return {
    id: tx.id,
    type: input.type,
    amount,
    currency: account.currency,
    account: { id: account.id, name: account.name },
    category,
    dryRun: input.dryRun,
    /** Ready for the Shortcuts "Show notification" action. */
    message: input.dryRun ? `Así quedaría: ${parts.join(" · ")}` : `✓ Registrado: ${parts.join(" · ")}`,
  }
}
