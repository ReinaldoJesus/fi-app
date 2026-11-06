import "server-only"
import { prisma } from "@/lib/prisma"
import { todayParts } from "../dates"
import { num, numOrNull } from "./guards"

/** Home screen: balances, month totals, recent movements, budgets and upcoming charges. */
export async function getSummary(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [accounts, monthTransactions, recentTransactions, categories, subscriptions, budgets, user] = await Promise.all([
    prisma.finAccount.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, balance: true, creditLimit: true, currency: true, color: true, bank: true },
      orderBy: [{ bank: "asc" }, { type: "asc" }, { name: "asc" }],
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true, type: true, categoryId: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
      select: {
        id: true, amount: true, type: true, description: true, date: true,
        category: { select: { name: true, color: true, icon: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, icon: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.subscription.findMany({
      where: { userId, active: true },
      select: { id: true, name: true, amount: true, icon: true, category: true, billingDay: true },
      orderBy: { billingDay: "asc" },
    }),
    prisma.budget.findMany({
      where: { userId, year: now.getFullYear(), month: now.getMonth() + 1 },
      select: { amount: true, categoryId: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { defaultAccountId: true } }),
  ])

  const checkingBalance = accounts
    .filter(a => a.type === "CHECKING" || a.type === "SAVINGS")
    .reduce((s, a) => s + num(a.balance), 0)
  const creditDebt = accounts
    .filter(a => a.type === "CREDIT_CARD")
    .reduce((s, a) => s + Math.abs(Math.min(0, num(a.balance))), 0)
  const incomeMonth = monthTransactions.filter(t => t.type === "INCOME").reduce((s, t) => s + num(t.amount), 0)
  const expensesMonth = monthTransactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + num(t.amount), 0)

  const budgetProgress = budgets
    .map(b => {
      const cat = categories.find(c => c.id === b.categoryId)
      const spent = monthTransactions
        .filter(t => t.type === "EXPENSE" && t.categoryId === b.categoryId)
        .reduce((s, t) => s + num(t.amount), 0)
      const budget = num(b.amount)
      return {
        categoryId: b.categoryId,
        name: cat?.name ?? "Sin nombre",
        icon: cat?.icon ?? null,
        color: cat?.color ?? "#86868b",
        budget,
        spent,
        pct: budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0,
      }
    })
    .filter(b => b.budget > 0)
    .sort((a, b) => b.pct - a.pct)

  return {
    checkingBalance,
    creditDebt,
    netBalance: checkingBalance - creditDebt,
    incomeMonth,
    expensesMonth,
    defaultAccountId: user?.defaultAccountId ?? null,
    accounts: accounts.map(a => ({ ...a, balance: num(a.balance), creditLimit: numOrNull(a.creditLimit) })),
    recentTransactions: recentTransactions.map(t => ({ ...t, amount: num(t.amount), date: t.date.toISOString() })),
    categories,
    subscriptions: subscriptions.map(s => ({ ...s, amount: num(s.amount) })),
    budgetProgress,
  }
}

/** Income vs expenses for the last N months, category breakdown and month projection. */
export async function getAnalytics(userId: string, months = 6) {
  const now = new Date()
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)

  const [txs, budgets, categories, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: since }, type: { in: ["INCOME", "EXPENSE"] } },
      select: { amount: true, type: true, date: true, category: { select: { id: true, name: true, color: true, icon: true } } },
    }),
    prisma.budget.findMany({
      where: { userId, year: now.getFullYear(), month: now.getMonth() + 1 },
      select: { amount: true, categoryId: true },
    }),
    prisma.category.findMany({
      where: { userId, type: "EXPENSE" },
      select: { id: true, name: true, color: true, icon: true },
    }),
    prisma.finAccount.findMany({ where: { userId }, select: { balance: true } }),
  ])

  const netWorth = accounts.reduce((s, a) => s + num(a.balance), 0)

  const monthsArr: { label: string; income: number; expense: number; savings: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = new Intl.DateTimeFormat("es-CL", { month: "short" }).format(d)
    const y = d.getFullYear(), m = d.getMonth()
    const monthTxs = txs.filter(t => t.date.getFullYear() === y && t.date.getMonth() === m)
    const income = monthTxs.filter(t => t.type === "INCOME").reduce((s, t) => s + num(t.amount), 0)
    const expense = monthTxs.filter(t => t.type === "EXPENSE").reduce((s, t) => s + num(t.amount), 0)
    monthsArr.push({ label: label.charAt(0).toUpperCase() + label.slice(1), income, expense, savings: income - expense })
  }

  const catMap: Record<string, { name: string; color: string; icon: string | null; amount: number }> = {}
  for (const t of txs) {
    if (t.type !== "EXPENSE" || t.date.getFullYear() !== now.getFullYear() || t.date.getMonth() !== now.getMonth()) continue
    const key = t.category?.id ?? "sin-categoria"
    catMap[key] ??= { name: t.category?.name ?? "Sin categoría", color: t.category?.color ?? "#86868b", icon: t.category?.icon ?? null, amount: 0 }
    catMap[key].amount += num(t.amount)
  }
  const byCategory = Object.values(catMap).sort((a, b) => b.amount - a.amount)
  const budgetMap: Record<string, number> = Object.fromEntries(budgets.map(b => [b.categoryId, num(b.amount)]))

  const today = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const last3 = monthsArr.slice(-4, -1)
  const avgMonthlyExpense = last3.length > 0 ? last3.reduce((s, m) => s + m.expense, 0) / last3.length : 0
  const currentExpense = monthsArr[monthsArr.length - 1]?.expense ?? 0
  const projectedExpense = today > 0 ? Math.round((currentExpense / today) * daysInMonth) : 0

  return { months: monthsArr, byCategory, categories, budgetMap, avgMonthlyExpense, projectedExpense, today, daysInMonth, netWorth }
}

export type AppNotification = {
  id: string
  type: "SUBSCRIPTION" | "INACTIVITY"
  title: string
  body: string
  icon: string | null
}

const fmtCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

/** Data for the app shell: theme/preferences, upcoming-charge alerts and inactivity reminder. */
export async function getNotifications(userId: string) {
  const { year, month, day: today } = todayParts()
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(today).padStart(2, "0")}`
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`)

  const [user, subs, todayTxCount, accountCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { theme: true, notifSubscriptions: true, notifInactivity: true, hideAmountsOnStart: true },
    }),
    prisma.subscription.findMany({
      where: { userId, active: true, billingDay: { not: null } },
      select: { id: true, name: true, billingDay: true, icon: true, amount: true },
    }),
    prisma.transaction.count({ where: { userId, date: { gte: todayStart } } }),
    prisma.finAccount.count({ where: { userId } }),
  ])

  const daysUntil = (billingDay: number) =>
    billingDay >= today ? billingDay - today : daysInMonth - today + billingDay
  const urgent = subs.filter(s => s.billingDay != null && daysUntil(s.billingDay) <= 3)

  const notifications: AppNotification[] = []
  if (user?.notifSubscriptions !== false) {
    for (const s of urgent) {
      const days = daysUntil(s.billingDay!)
      notifications.push({
        id: `sub-${s.id}-${todayStr}`,
        type: "SUBSCRIPTION",
        title: days === 0 ? `${s.name} cobra hoy` : days === 1 ? `${s.name} cobra mañana` : `${s.name} cobra en ${days} días`,
        body: `${fmtCLP(num(s.amount))}/mes`,
        icon: s.icon ?? null,
      })
    }
  }
  if (user?.notifInactivity !== false && accountCount > 0 && todayTxCount === 0) {
    notifications.push({
      id: `inactivity-${todayStr}`,
      type: "INACTIVITY",
      title: "Sin movimientos hoy",
      body: "No has registrado ingresos ni gastos por el momento.",
      icon: null,
    })
  }

  return {
    theme: user?.theme ?? "system",
    hideAmountsOnStart: user?.hideAmountsOnStart ?? false,
    urgentSubscriptionsCount: urgent.length,
    notifications,
  }
}
