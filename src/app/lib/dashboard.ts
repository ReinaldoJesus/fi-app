import "server-only"
import { prisma } from "@/lib/prisma"

export async function getDashboardData(userId: string) {
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  const [accounts, todayTransactions, recentTransactions, categories] = await Promise.all([
    prisma.finAccount.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, balance: true, currency: true, color: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfDay, lt: endOfDay } },
      select: { amount: true, type: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        date: true,
        category: { select: { name: true, color: true, icon: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, icon: true },
      orderBy: { name: "asc" },
    }),
  ])

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0)

  const incomeToday = todayTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const expensesToday = todayTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return {
    totalBalance,
    incomeToday,
    expensesToday,
    netToday: incomeToday - expensesToday,
    accounts,
    recentTransactions,
    categories,
  }
}
