import "server-only"
import { prisma } from "@/lib/prisma"

export async function getDashboardData(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [accounts, monthTransactions, recentTransactions, categories, subscriptions, budgets] = await Promise.all([
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
  ])

  const checkingBalance = accounts
    .filter((a) => a.type === "CHECKING" || a.type === "SAVINGS")
    .reduce((s, a) => s + Number(a.balance), 0)

  const creditDebt = accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((s, a) => s + Math.abs(Math.min(0, Number(a.balance))), 0)

  const incomeMonth = monthTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + Number(t.amount), 0)

  const expensesMonth = monthTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + Number(t.amount), 0)

  const budgetProgress = budgets
    .map(b => {
      const cat = categories.find(c => c.id === b.categoryId)
      const spent = monthTransactions
        .filter(t => t.type === "EXPENSE" && t.categoryId === b.categoryId)
        .reduce((s, t) => s + Number(t.amount), 0)
      const budget = Number(b.amount)
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
    accounts,
    recentTransactions,
    categories,
    subscriptions,
    budgetProgress,
  }
}

export async function getAccountsData(userId: string) {
  return prisma.finAccount.findMany({
    where: { userId },
    select: {
      id: true, name: true, type: true, balance: true, creditLimit: true, currency: true, color: true, bank: true,
      _count: { select: { transactions: true } },
    },
    orderBy: [{ bank: "asc" }, { type: "asc" }, { name: "asc" }],
  })
}

export async function getSavingsData(userId: string) {
  return prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAnalyticsData(userId: string, months = 6) {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)

  const [txs, budgets, categories, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: sixMonthsAgo }, type: { in: ["INCOME", "EXPENSE"] as never[] } },
      select: { amount: true, type: true, date: true, category: { select: { id: true, name: true, color: true, icon: true } } },
    }),
    prisma.budget.findMany({
      where: { userId, year: now.getFullYear(), month: now.getMonth() + 1 },
      select: { amount: true, categoryId: true },
    }),
    prisma.category.findMany({
      where: { userId, type: "EXPENSE" as never },
      select: { id: true, name: true, color: true, icon: true },
    }),
    prisma.finAccount.findMany({
      where: { userId },
      select: { balance: true },
    }),
  ])

  // Net worth across all accounts (CLP-equivalent, best effort)
  const netWorth = accounts.reduce((s, a) => s + Number(a.balance), 0)

  // Monthly income vs expenses
  const monthsArr: { label: string; income: number; expense: number; savings: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = new Intl.DateTimeFormat("es-CL", { month: "short" }).format(d)
    const y = d.getFullYear(), m = d.getMonth()
    const monthTxs = txs.filter(t => {
      const td = new Date(t.date)
      return td.getFullYear() === y && td.getMonth() === m
    })
    const income = monthTxs.filter(t => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0)
    const expense = monthTxs.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0)
    monthsArr.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      income,
      expense,
      savings: income - expense,
    })
  }

  // Category breakdown current month
  const currentMonthTxs = txs.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && t.type === "EXPENSE"
  })
  const catMap: Record<string, { name: string; color: string; icon: string | null; amount: number }> = {}
  for (const t of currentMonthTxs) {
    const key = t.category?.id ?? "sin-categoria"
    if (!catMap[key]) catMap[key] = { name: t.category?.name ?? "Sin categoría", color: t.category?.color ?? "#86868b", icon: t.category?.icon ?? null, amount: 0 }
    catMap[key].amount += Number(t.amount)
  }
  const byCategory = Object.values(catMap).sort((a, b) => b.amount - a.amount)

  // Budget usage current month
  const budgetMap = Object.fromEntries(budgets.map(b => [b.categoryId, Number(b.amount)]))

  // Projection: avg daily spend from last 3 months → project rest of current month
  const today = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const last3 = monthsArr.slice(-4, -1) // exclude current month
  const avgMonthlyExpense = last3.length > 0 ? last3.reduce((s, m) => s + m.expense, 0) / last3.length : 0
  const currentExpense = monthsArr[monthsArr.length - 1]?.expense ?? 0
  const projectedExpense = today > 0 ? Math.round((currentExpense / today) * daysInMonth) : 0

  return { months: monthsArr, byCategory, categories, budgetMap, avgMonthlyExpense, projectedExpense, today, daysInMonth, netWorth }
}

export async function getTransactionsData(userId: string) {
  const now = new Date()
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1)
  const [transactions, accounts, categories, budgets, monthTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: twoYearsAgo } },
      orderBy: { date: "desc" },
      select: {
        id: true, amount: true, type: true, description: true, notes: true, date: true,
        category: { select: { id: true, name: true, color: true, icon: true } },
        account: { select: { id: true, name: true } },
      },
    }),
    prisma.finAccount.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, balance: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, icon: true },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({
      where: { userId, year: now.getFullYear(), month: now.getMonth() + 1 },
      select: { categoryId: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId, type: "EXPENSE", date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      select: { categoryId: true, amount: true },
    }),
  ])

  const budgetStatus: Record<string, { budget: number; spent: number }> = {}
  for (const b of budgets) {
    const spent = monthTxs
      .filter(t => t.categoryId === b.categoryId)
      .reduce((s, t) => s + Number(t.amount), 0)
    budgetStatus[b.categoryId] = { budget: Number(b.amount), spent }
  }

  return { transactions, accounts, categories, budgetStatus }
}

export async function getAccountTransactionsData(userId: string, accountId: string) {
  const [account, transactions] = await Promise.all([
    prisma.finAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, name: true, type: true, balance: true, creditLimit: true, color: true, currency: true },
    }),
    prisma.transaction.findMany({
      where: { userId, OR: [{ accountId }, { toAccountId: accountId }] },
      orderBy: { date: "desc" },
      select: {
        id: true, amount: true, type: true, description: true, date: true,
        accountId: true, toAccountId: true,
        category: { select: { name: true, color: true, icon: true } },
        account: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
      },
    }),
  ])
  return { account, transactions }
}
