import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { RecurringCreate } from "@/lib/api/schemas"
import { notFound } from "../errors"
import { todayParts } from "../dates"
import { assertAccounts, assertCategories, num } from "./guards"

const recurringSelect = {
  id: true, type: true, amount: true, description: true, dayOfMonth: true, active: true,
  lastGeneratedMonth: true, lastGeneratedYear: true,
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, icon: true } },
} as const

export async function listRecurring(userId: string) {
  const rows = await prisma.recurringTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: recurringSelect,
  })
  return rows.map(r => ({ ...r, amount: num(r.amount) }))
}

export async function createRecurring(userId: string, input: z.infer<typeof RecurringCreate>) {
  await assertAccounts(userId, [input.accountId])
  await assertCategories(userId, [input.categoryId], input.type)
  const r = await prisma.recurringTransaction.create({
    data: {
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amount: input.amount,
      description: input.description ?? null,
      dayOfMonth: input.dayOfMonth,
    },
    select: recurringSelect,
  })
  return { ...r, amount: num(r.amount) }
}

export async function setRecurringActive(userId: string, id: string, active: boolean) {
  const res = await prisma.recurringTransaction.updateMany({ where: { id, userId }, data: { active } })
  if (!res.count) throw notFound("Recurrencia")
  return { id, active }
}

export async function deleteRecurring(userId: string, id: string) {
  const res = await prisma.recurringTransaction.deleteMany({ where: { id, userId } })
  if (!res.count) throw notFound("Recurrencia")
  return { id }
}

const MAX_CATCH_UP_MONTHS = 12

/**
 * Creates the movements of active recurring rules that are due, including months
 * missed while the user was away (up to 12). Each month is claimed with a
 * conditional update first, so two concurrent page loads can't both insert it.
 */
export async function generateDueRecurring(userId: string) {
  const today = todayParts()
  const pending = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      active: true,
      // Never-generated rules have NULLs, which a plain NOT {...} would silently exclude.
      OR: [
        { lastGeneratedMonth: null },
        { lastGeneratedYear: null },
        { NOT: { lastGeneratedMonth: today.month, lastGeneratedYear: today.year } },
      ],
    },
  })

  let generated = 0
  for (const r of pending) {
    // Months to cover: the one after the last generated (or the current month for a new rule) up to now.
    let y = r.lastGeneratedYear ?? today.year
    let m = r.lastGeneratedMonth ?? today.month - 1
    let lastYear = r.lastGeneratedYear
    let lastMonth = r.lastGeneratedMonth

    for (let i = 0; i < MAX_CATCH_UP_MONTHS; i++) {
      m += 1
      if (m > 12) { m = 1; y += 1 }
      const isCurrent = y === today.year && m === today.month
      if (y > today.year || (y === today.year && m > today.month)) break
      if (isCurrent && r.dayOfMonth > today.day) break

      const claim = await prisma.recurringTransaction.updateMany({
        where: { id: r.id, lastGeneratedMonth: lastMonth, lastGeneratedYear: lastYear },
        data: { lastGeneratedMonth: m, lastGeneratedYear: y },
      })
      if (!claim.count) break // another request is generating this rule

      try {
        await prisma.$transaction([
          prisma.transaction.create({
            data: {
              userId,
              accountId: r.accountId,
              categoryId: r.categoryId,
              type: r.type,
              amount: r.amount,
              description: r.description ?? "Movimiento recurrente",
              date: new Date(`${y}-${String(m).padStart(2, "0")}-${String(r.dayOfMonth).padStart(2, "0")}T12:00:00.000Z`),
              notes: "Generado automáticamente",
            },
          }),
          prisma.finAccount.update({
            where: { id: r.accountId },
            data: { balance: { [r.type === "INCOME" ? "increment" : "decrement"]: r.amount } },
          }),
        ])
      } catch (err) {
        // Release the claim so the month is retried on the next load.
        await prisma.recurringTransaction.update({
          where: { id: r.id },
          data: { lastGeneratedMonth: lastMonth, lastGeneratedYear: lastYear },
        })
        throw err
      }
      lastMonth = m
      lastYear = y
      generated++
    }
  }
  return { generated }
}
