import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import {
  TransactionCreate, TransactionUpdate, TransactionImport, TransactionListQuery, TransferCreate,
} from "@/lib/api/schemas"
import { badRequest, notFound } from "../errors"
import { parseDateInput } from "../dates"
import { assertAccounts, assertCategories, num } from "./guards"

type Movement = { type: string; amount: number; accountId: string; toAccountId: string | null }

/**
 * How a movement changes account balances. Every create/update/delete goes
 * through this so balances stay consistent (including transfers, whose
 * destination account was previously never reverted).
 */
function balanceEffects(m: Movement): { accountId: string; delta: number }[] {
  if (m.type === "INCOME") return [{ accountId: m.accountId, delta: m.amount }]
  if (m.type === "EXPENSE") return [{ accountId: m.accountId, delta: -m.amount }]
  if (m.type === "TRANSFER" && m.toAccountId) {
    return [
      { accountId: m.accountId, delta: -m.amount },
      { accountId: m.toAccountId, delta: m.amount },
    ]
  }
  return [{ accountId: m.accountId, delta: -m.amount }]
}

function balanceOps(effects: { accountId: string; delta: number }[]) {
  const byAccount = new Map<string, number>()
  for (const e of effects) byAccount.set(e.accountId, (byAccount.get(e.accountId) ?? 0) + e.delta)
  return [...byAccount]
    .filter(([, delta]) => delta !== 0)
    .map(([id, delta]) => prisma.finAccount.update({ where: { id }, data: { balance: { increment: delta } } }))
}

const txSelect = {
  id: true, amount: true, type: true, description: true, notes: true, date: true,
  accountId: true, toAccountId: true, categoryId: true, createdAt: true,
  category: { select: { id: true, name: true, color: true, icon: true } },
  account: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  receipt: { select: { id: true } },
} satisfies Prisma.TransactionSelect

type TxRow = Prisma.TransactionGetPayload<{ select: typeof txSelect }>

export function serializeTransaction({ receipt, ...t }: TxRow) {
  return { ...t, amount: num(t.amount), date: t.date.toISOString(), createdAt: t.createdAt.toISOString(), hasReceipt: !!receipt }
}

export async function listTransactions(userId: string, q: z.infer<typeof TransactionListQuery>) {
  const where: Prisma.TransactionWhereInput = {
    userId,
    ...(q.type ? { type: q.type } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.accountId ? { OR: [{ accountId: q.accountId }, { toAccountId: q.accountId }] } : {}),
    ...(q.from || q.to
      ? {
          date: {
            ...(q.from ? { gte: new Date(`${q.from.slice(0, 10)}T00:00:00.000Z`) } : {}),
            ...(q.to ? { lte: new Date(`${q.to.slice(0, 10)}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }
  const rows = await prisma.transaction.findMany({
    where,
    select: txSelect,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  })
  const hasMore = rows.length > q.limit
  const items = rows.slice(0, q.limit).map(serializeTransaction)
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null }
}

export async function getTransaction(userId: string, id: string) {
  const t = await prisma.transaction.findFirst({ where: { id, userId }, select: txSelect })
  if (!t) throw notFound("Transacción")
  return serializeTransaction(t)
}

export async function createTransaction(userId: string, input: z.infer<typeof TransactionCreate>) {
  await assertAccounts(userId, [input.accountId])
  await assertCategories(userId, [input.categoryId], input.type)

  const data = {
    type: input.type,
    amount: input.amount,
    description: input.description ?? null,
    notes: input.notes ?? null,
    date: parseDateInput(input.date),
    userId,
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
  }
  const [created] = await prisma.$transaction([
    prisma.transaction.create({ data, select: txSelect }),
    ...balanceOps(balanceEffects({ ...data, toAccountId: null })),
  ])
  return serializeTransaction(created)
}

export async function createTransfer(userId: string, input: z.infer<typeof TransferCreate>) {
  await assertAccounts(userId, [input.fromAccountId, input.toAccountId])

  const data = {
    type: "TRANSFER" as const,
    amount: input.amount,
    description: input.description ?? null,
    date: parseDateInput(input.date),
    userId,
    accountId: input.fromAccountId,
    toAccountId: input.toAccountId,
  }
  const [created] = await prisma.$transaction([
    prisma.transaction.create({ data, select: txSelect }),
    ...balanceOps(balanceEffects(data)),
  ])
  return serializeTransaction(created)
}

/**
 * Reverts the old movement's effect and applies the new one, so changing the
 * account, the type or the amount keeps every balance right.
 * Transfers can change amount, date, description and notes only.
 */
export async function updateTransaction(userId: string, id: string, input: z.infer<typeof TransactionUpdate>) {
  const old = await prisma.transaction.findFirst({ where: { id, userId } })
  if (!old) throw notFound("Transacción")

  const isTransfer = old.type === "TRANSFER"
  if (isTransfer && input.type) {
    throw badRequest("Una transferencia no puede convertirse en ingreso o gasto")
  }

  const type = isTransfer ? "TRANSFER" : (input.type ?? old.type)
  const accountId = isTransfer ? old.accountId : (input.accountId ?? old.accountId)
  const categoryId = isTransfer ? null : input.categoryId !== undefined ? input.categoryId : old.categoryId
  const amount = input.amount ?? num(old.amount)

  if (!isTransfer) {
    await assertAccounts(userId, [accountId])
    if (categoryId) await assertCategories(userId, [categoryId], type as 'INCOME' | 'EXPENSE')
  }

  const before = balanceEffects({ type: old.type, amount: num(old.amount), accountId: old.accountId, toAccountId: old.toAccountId })
  const after = balanceEffects({ type, amount, accountId, toAccountId: old.toAccountId })

  const [updated] = await prisma.$transaction([
    prisma.transaction.update({
      where: { id },
      data: {
        type: type as never,
        amount,
        accountId,
        categoryId,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.date ? { date: parseDateInput(input.date) } : {}),
      },
      select: txSelect,
    }),
    ...balanceOps([...before.map(e => ({ ...e, delta: -e.delta })), ...after]),
  ])
  return serializeTransaction(updated)
}

export async function deleteTransaction(userId: string, id: string) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } })
  if (!tx) throw notFound("Transacción")

  const effects = balanceEffects({ type: tx.type, amount: num(tx.amount), accountId: tx.accountId, toAccountId: tx.toAccountId })
  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    ...balanceOps(effects.map(e => ({ ...e, delta: -e.delta }))),
  ])
  return { id }
}

/**
 * Deletes several movements in one database transaction and reverts their effect
 * on every balance. Ids that are not this person's are ignored (never 403-leaks),
 * so the answer says how many were actually deleted.
 */
export async function deleteTransactions(userId: string, ids: string[]) {
  const txs = await prisma.transaction.findMany({
    where: { userId, id: { in: [...new Set(ids)] } },
    select: { id: true, type: true, amount: true, accountId: true, toAccountId: true },
  })
  if (!txs.length) throw notFound("Movimientos")
  const effects = txs.flatMap(t => balanceEffects({ type: t.type, amount: num(t.amount), accountId: t.accountId, toAccountId: t.toAccountId }))
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId, id: { in: txs.map(t => t.id) } } }),
    ...balanceOps(effects.map(e => ({ ...e, delta: -e.delta }))),
  ])
  return { deleted: txs.length }
}

export async function importTransactions(userId: string, input: z.infer<typeof TransactionImport>) {
  const { rows } = input
  await assertAccounts(userId, rows.map(r => r.accountId))
  await assertCategories(userId, rows.map(r => r.categoryId))

  const data = rows.map(r => ({
    type: r.type,
    amount: r.amount,
    description: r.description ?? null,
    date: parseDateInput(r.date),
    userId,
    accountId: r.accountId,
    categoryId: r.categoryId ?? null,
  }))

  await prisma.$transaction([
    prisma.transaction.createMany({ data }),
    ...balanceOps(data.flatMap(d => balanceEffects({ ...d, toAccountId: null }))),
  ])
  return { imported: rows.length }
}

/** Data for the "Movimientos" screen: last 2 years, accounts, categories and budget status. */
export async function getTransactionsOverview(userId: string) {
  const now = new Date()
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1)
  const [transactions, accounts, categories, budgets, monthTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: twoYearsAgo } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, amount: true, type: true, description: true, notes: true, date: true, createdAt: true,
        category: { select: { id: true, name: true, color: true, icon: true } },
        account: { select: { id: true, name: true } },
        receipt: { select: { id: true } },
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
    const spent = monthTxs.filter(t => t.categoryId === b.categoryId).reduce((s, t) => s + num(t.amount), 0)
    budgetStatus[b.categoryId] = { budget: num(b.amount), spent }
  }

  return {
    transactions: transactions.map(({ receipt, ...t }) => ({ ...t, amount: num(t.amount), date: t.date.toISOString(), createdAt: t.createdAt.toISOString(), hasReceipt: !!receipt })),
    accounts: accounts.map(a => ({ ...a, balance: num(a.balance) })),
    categories,
    budgetStatus,
  }
}
