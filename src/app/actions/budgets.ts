"use server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function copyBudgetsFromPreviousMonth(month: number, year: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  const userId = session.user.id

  // Search backwards up to 24 months for the most recent month with budgets
  let sourceBudgets: { categoryId: string; amount: unknown }[] = []
  let m = month, y = year
  for (let i = 0; i < 24; i++) {
    if (m === 1) { m = 12; y -= 1 } else { m -= 1 }
    const found = await prisma.budget.findMany({ where: { userId, month: m, year: y } })
    if (found.length > 0) { sourceBudgets = found; break }
  }

  if (sourceBudgets.length === 0) return { error: "No encontramos presupuestos anteriores. Fija los montos manualmente." }

  await prisma.budget.createMany({
    data: sourceBudgets.map(b => ({
      userId,
      categoryId: b.categoryId,
      amount: b.amount as never,
      month,
      year,
    })),
    skipDuplicates: true,
  })

  revalidatePath("/dashboard/budgets")
  return { copied: sourceBudgets.length }
}

export async function upsertBudget(categoryId: string, amount: number, month: number, year: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  if (amount <= 0) {
    await prisma.budget.deleteMany({ where: { userId: session.user.id, categoryId, month, year } })
  } else {
    await prisma.budget.upsert({
      where: { userId_categoryId_month_year: { userId: session.user.id, categoryId, month, year } },
      create: { userId: session.user.id, categoryId, amount, month, year },
      update: { amount },
    })
  }
  revalidatePath("/dashboard/budgets")
}
