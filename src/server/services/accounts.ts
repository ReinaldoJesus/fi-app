import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { AccountCreate, AccountUpdate } from "@/lib/api/schemas"
import { notFound } from "../errors"
import { ensureDefaultCategories } from "./categories"
import { num, numOrNull } from "./guards"

const accountSelect = {
  id: true, name: true, type: true, balance: true, creditLimit: true, currency: true,
  color: true, bank: true, createdAt: true,
  _count: { select: { transactions: true } },
} as const

type AccountRow = {
  balance: unknown; creditLimit: unknown; createdAt: Date
  [k: string]: unknown
}

function serialize<T extends AccountRow>(a: T) {
  return { ...a, balance: num(a.balance), creditLimit: numOrNull(a.creditLimit), createdAt: a.createdAt.toISOString() }
}

export async function listAccounts(userId: string) {
  const rows = await prisma.finAccount.findMany({
    where: { userId },
    select: accountSelect,
    orderBy: [{ bank: "asc" }, { type: "asc" }, { name: "asc" }],
  })
  return rows.map(serialize)
}

export async function getAccount(userId: string, id: string) {
  const a = await prisma.finAccount.findFirst({ where: { id, userId }, select: accountSelect })
  if (!a) throw notFound("Cuenta")
  return serialize(a)
}

export async function createAccount(userId: string, input: z.infer<typeof AccountCreate>) {
  const isCredit = input.type === "CREDIT_CARD"
  // Credit card balance is negative debt: used amount 50.000 → balance -50.000.
  const balance = isCredit ? -(input.usedAmount ?? 0) : (input.balance ?? 0)
  const creditLimit = isCredit ? (input.creditLimit ?? null) : null

  const created = await prisma.finAccount.create({
    data: {
      name: input.name, type: input.type, bank: input.bank ?? null, color: input.color,
      currency: input.currency, balance, creditLimit, userId,
    },
    select: accountSelect,
  })
  await ensureDefaultCategories(userId)
  return serialize(created)
}

export async function updateAccount(userId: string, id: string, input: z.infer<typeof AccountUpdate>) {
  await getAccount(userId, id)
  const updated = await prisma.finAccount.update({ where: { id }, data: input, select: accountSelect })
  return serialize(updated)
}

export async function deleteAccount(userId: string, id: string) {
  await getAccount(userId, id)
  await prisma.$transaction([
    // Clear the default-account preference if it pointed here.
    prisma.user.updateMany({ where: { id: userId, defaultAccountId: id }, data: { defaultAccountId: null } }),
    prisma.finAccount.delete({ where: { id } }),
  ])
  return { id }
}

/** Sets the balance to the real one, recording the difference as an adjustment movement. */
export async function reconcileAccount(userId: string, id: string, realBalance: number) {
  const account = await getAccount(userId, id)
  const delta = Math.round((realBalance - account.balance) * 100) / 100
  if (delta === 0) return { delta: 0, balance: account.balance }

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        type: delta > 0 ? "INCOME" : "EXPENSE",
        amount: Math.abs(delta),
        description: "Ajuste de saldo",
        date: new Date(),
        userId,
        accountId: id,
      },
    }),
    prisma.finAccount.update({ where: { id }, data: { balance: realBalance } }),
  ])
  return { delta, balance: realBalance }
}

/** Account header plus every movement that touches it (as origin or transfer destination). */
export async function getAccountStatement(userId: string, accountId: string) {
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
  if (!account) return { account: null, transactions: [] }
  return {
    account: { ...account, balance: num(account.balance), creditLimit: numOrNull(account.creditLimit) },
    transactions: transactions.map(t => ({ ...t, amount: num(t.amount), date: t.date.toISOString() })),
  }
}
