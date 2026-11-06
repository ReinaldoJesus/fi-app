import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import BudgetsClient from "./BudgetsClient"

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await auth()
  const userId = session!.user!.id!
  const params = await searchParams
  const now = new Date()
  const month = Math.min(12, Math.max(1, parseInt(params.month ?? "") || now.getMonth() + 1))
  const year = parseInt(params.year ?? "") || now.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const [userSettings, categories, txs, rawBudgets] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { budgetCarryOver: true } }),
    prisma.category.findMany({
      where: { userId, type: "EXPENSE" },
      select: { id: true, name: true, color: true, icon: true },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId, type: "EXPENSE", date: { gte: start, lte: end } },
      select: { amount: true, categoryId: true },
    }),
    prisma.budget.findMany({
      where: { userId, month, year },
      select: { categoryId: true, amount: true },
    }),
  ])

  // Auto-copy from previous month if setting is on and this month has no budgets yet
  let budgets = rawBudgets
  if (userSettings?.budgetCarryOver && budgets.length === 0) {
    let m = month, y = year
    for (let i = 0; i < 24; i++) {
      if (m === 1) { m = 12; y -= 1 } else { m -= 1 }
      const found = await prisma.budget.findMany({ where: { userId, month: m, year: y } })
      if (found.length > 0) {
        await prisma.budget.createMany({
          data: found.map(b => ({ userId, categoryId: b.categoryId, amount: b.amount, month, year })),
          skipDuplicates: true,
        })
        budgets = await prisma.budget.findMany({ where: { userId, month, year }, select: { categoryId: true, amount: true } })
        break
      }
    }
  }

  const spent: Record<string, number> = {}
  for (const tx of txs) {
    if (!tx.categoryId) continue
    spent[tx.categoryId] = (spent[tx.categoryId] ?? 0) + Number(tx.amount)
  }

  const budgetMap = Object.fromEntries(budgets.map(b => [b.categoryId, Number(b.amount)]))

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <BudgetsClient
        categories={categories}
        spent={spent}
        budgetMap={budgetMap}
        month={month}
        year={year}
      />
    </div>
  )
}
