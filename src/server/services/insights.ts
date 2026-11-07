import "server-only"
import { prisma } from "@/lib/prisma"
import { num } from "./guards"

const SUGGESTION_WINDOW_DAYS = 180
const MAX_SUGGESTIONS = 40

/**
 * Smart defaults for the "new movement" form: descriptions the user writes
 * often, each with the category, account and amount they usually go with,
 * plus the most used category per type.
 */
export async function getTransactionSuggestions(userId: string) {
  const since = new Date(Date.now() - SUGGESTION_WINDOW_DAYS * 86_400_000)
  const rows = await prisma.transaction.findMany({
    where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: since } },
    select: { description: true, type: true, categoryId: true, accountId: true, amount: true },
    orderBy: { date: "desc" },
    take: 2000,
  })

  type Agg = { description: string; type: "INCOME" | "EXPENSE"; count: number; categoryId: string | null; accountId: string; amount: number }
  const byDescription = new Map<string, Agg>()
  const categoryCount = { INCOME: new Map<string, number>(), EXPENSE: new Map<string, number>() }
  const accountCount = new Map<string, number>()

  for (const r of rows) {
    const type = r.type as "INCOME" | "EXPENSE"
    accountCount.set(r.accountId, (accountCount.get(r.accountId) ?? 0) + 1)
    if (r.categoryId) categoryCount[type].set(r.categoryId, (categoryCount[type].get(r.categoryId) ?? 0) + 1)
    const description = r.description?.trim()
    if (!description) continue
    const key = `${type}:${description.toLowerCase()}`
    const agg = byDescription.get(key)
    if (agg) {
      agg.count++
      // Rows come newest first: keep the latest category/account/amount, fill gaps from older ones.
      agg.categoryId ??= r.categoryId
    } else {
      byDescription.set(key, { description, type, count: 1, categoryId: r.categoryId, accountId: r.accountId, amount: num(r.amount) })
    }
  }

  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return {
    suggestions: [...byDescription.values()].sort((a, b) => b.count - a.count).slice(0, MAX_SUGGESTIONS),
    topCategory: { INCOME: top(categoryCount.INCOME), EXPENSE: top(categoryCount.EXPENSE) },
    topAccount: top(accountCount),
  }
}

/**
 * First-run checklist ("Arma tu Clarifi"). Creating the account already counts,
 * so progress never starts at zero.
 */
export async function getOnboarding(userId: string) {
  const [accounts, transactions, budgets, subscriptions] = await Promise.all([
    prisma.finAccount.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.budget.count({ where: { userId } }),
    prisma.subscription.count({ where: { userId, active: true } }),
  ])
  const steps = [
    { id: "signup", label: "Tu cuenta Clarifi", description: "Ya está creada.", done: true, href: "/dashboard/profile" },
    { id: "account", label: "Primera cuenta", description: "Cuenta bancaria, tarjeta o efectivo.", done: accounts > 0, href: "/dashboard/accounts" },
    { id: "transaction", label: "Primer movimiento", description: "Registra un ingreso o gasto.", done: transactions > 0, href: "/dashboard/transactions" },
    { id: "budget", label: "Primer presupuesto", description: "Fija un límite mensual por categoría.", done: budgets > 0, href: "/dashboard/budgets" },
    { id: "subscription", label: "Suscripción activa", description: "Netflix, Spotify u otro cobro fijo.", done: subscriptions > 0, href: "/dashboard/subscriptions" },
  ]
  const done = steps.filter(s => s.done).length
  return { steps, done, total: steps.length, percent: Math.round((done / steps.length) * 100), completed: done === steps.length }
}

/** Puts subscriptions in context: their share of the average monthly income (last 3 full months). */
export async function getSubscriptionsInsight(userId: string) {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [income, subs] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, type: "INCOME", date: { gte: from, lt: to } }, _sum: { amount: true } }),
    prisma.subscription.findMany({ where: { userId, active: true }, select: { amount: true, currency: true } }),
  ])
  const monthlyTotal = subs.filter(s => s.currency === "CLP").reduce((s, x) => s + num(x.amount), 0)
  const avgMonthlyIncome = Math.round(num(income._sum.amount ?? 0) / 3)
  return {
    monthlyTotal,
    avgMonthlyIncome,
    shareOfIncome: avgMonthlyIncome > 0 ? Math.round((monthlyTotal / avgMonthlyIncome) * 1000) / 10 : null,
  }
}
