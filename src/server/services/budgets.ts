import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { BudgetUpsert } from "@/lib/api/schemas"
import { ApiError } from "../errors"
import { assertCategories, num } from "./guards"

const prevMonth = (m: number, y: number) => (m === 1 ? { m: 12, y: y - 1 } : { m: m - 1, y })

/** Budgets of the most recent month with any, looking back up to 24 months. */
async function findPreviousBudgets(userId: string, month: number, year: number) {
  let { m, y } = prevMonth(month, year)
  for (let i = 0; i < 24; i++) {
    const found = await prisma.budget.findMany({ where: { userId, month: m, year: y } })
    if (found.length) return found
    ;({ m, y } = prevMonth(m, y))
  }
  return []
}

export async function copyBudgetsFromPrevious(userId: string, month: number, year: number) {
  const source = await findPreviousBudgets(userId, month, year)
  if (!source.length) throw new ApiError(404, "not_found", "No encontramos presupuestos anteriores. Fija los montos manualmente.")
  const res = await prisma.budget.createMany({
    data: source.map(b => ({ userId, categoryId: b.categoryId, amount: b.amount, month, year })),
    skipDuplicates: true,
  })
  return { copied: res.count }
}

export async function upsertBudget(userId: string, input: z.infer<typeof BudgetUpsert>) {
  const { categoryId, month, year, amount } = input
  await assertCategories(userId, [categoryId], "EXPENSE")
  const key = { userId_categoryId_month_year: { userId, categoryId, month, year } }

  if (amount <= 0) {
    await prisma.budget.deleteMany({ where: { userId, categoryId, month, year } })
    return { categoryId, month, year, amount: 0 }
  }
  const b = await prisma.budget.upsert({
    where: key,
    create: { userId, categoryId, amount, month, year },
    update: { amount },
  })
  return { categoryId: b.categoryId, month: b.month, year: b.year, amount: num(b.amount) }
}

/**
 * Budgets and spending for one month, per expense category. When the user has
 * "carry over" on and the month is still empty, last month's budgets are copied in.
 */
export async function getBudgetMonth(userId: string, month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  const [user, categories, txs, rawBudgets] = await Promise.all([
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
    prisma.budget.findMany({ where: { userId, month, year }, select: { categoryId: true, amount: true } }),
  ])

  let budgets = rawBudgets
  if (user?.budgetCarryOver && budgets.length === 0) {
    const source = await findPreviousBudgets(userId, month, year)
    if (source.length) {
      await prisma.budget.createMany({
        data: source.map(b => ({ userId, categoryId: b.categoryId, amount: b.amount, month, year })),
        skipDuplicates: true,
      })
      budgets = await prisma.budget.findMany({ where: { userId, month, year }, select: { categoryId: true, amount: true } })
    }
  }

  const spent: Record<string, number> = {}
  for (const tx of txs) {
    if (!tx.categoryId) continue
    spent[tx.categoryId] = (spent[tx.categoryId] ?? 0) + num(tx.amount)
  }
  const budgetMap: Record<string, number> = Object.fromEntries(budgets.map(b => [b.categoryId, num(b.amount)]))
  const suggested = await suggestedBudgets(userId, month, year)

  return {
    month,
    year,
    categories,
    spent,
    budgetMap,
    suggested,
    items: categories.map(c => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      budget: budgetMap[c.id] ?? 0,
      spent: spent[c.id] ?? 0,
      suggested: suggested[c.id] ?? 0,
    })),
  }
}

const SUGGESTION_MONTHS = 3

/**
 * Smart default for each expense category: the average spent over the previous
 * three months, rounded up to the next $1.000. Categories without spending are left out.
 */
export async function suggestedBudgets(userId: string, month: number, year: number): Promise<Record<string, number>> {
  const from = new Date(Date.UTC(year, month - 1 - SUGGESTION_MONTHS, 1))
  const to = new Date(Date.UTC(year, month - 1, 1))
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, type: "EXPENSE", categoryId: { not: null }, date: { gte: from, lt: to } },
    _sum: { amount: true },
  })
  const out: Record<string, number> = {}
  for (const r of rows) {
    const avg = num(r._sum.amount ?? 0) / SUGGESTION_MONTHS
    if (r.categoryId && avg > 0) out[r.categoryId] = Math.ceil(avg / 1000) * 1000
  }
  return out
}

/** Sets the suggested amount on every category of the month that has no budget yet. */
export async function applySuggestedBudgets(userId: string, month: number, year: number) {
  const [suggested, existing] = await Promise.all([
    suggestedBudgets(userId, month, year),
    prisma.budget.findMany({ where: { userId, month, year }, select: { categoryId: true } }),
  ])
  const taken = new Set(existing.map(b => b.categoryId))
  const ownCategories = await prisma.category.findMany({
    where: { userId, type: "EXPENSE", id: { in: Object.keys(suggested) } },
    select: { id: true },
  })
  const data = ownCategories
    .filter(c => !taken.has(c.id))
    .map(c => ({ userId, categoryId: c.id, amount: suggested[c.id], month, year }))
  if (!data.length) throw new ApiError(404, "not_found", "No hay promedios para sugerir: registra gastos con categoría por un par de meses.")
  const res = await prisma.budget.createMany({ data, skipDuplicates: true })
  return { applied: res.count }
}
