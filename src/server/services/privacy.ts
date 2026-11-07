import "server-only"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { AccountDeletion } from "@/lib/api/schemas"
import { badRequest, notFound } from "../errors"

/** Converts Prisma Decimals and Dates into plain JSON values, recursively. */
function plain(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return (value as { toNumber(): number }).toNumber()
  }
  if (Array.isArray(value)) return value.map(plain)
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  return value
}

/**
 * Everything Clarifi stores about the user, for the "Descargar mis datos" right.
 * Excludes secrets: password hash and OAuth tokens.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, image: true, createdAt: true, theme: true,
      budgetCarryOver: true, notifSubscriptions: true, notifInactivity: true, notifBudget: true,
      hideAmountsOnStart: true, defaultAccountId: true,
      accounts: { select: { provider: true } },
    },
  })
  if (!user) throw notFound("Usuaria/o")

  const where = { userId }
  const [accounts, categories, transactions, budgets, savingsGoals, subscriptions, recurring, devices, receipts] = await Promise.all([
    prisma.finAccount.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({ where, orderBy: { date: "asc" } }),
    prisma.budget.findMany({ where, orderBy: [{ year: "asc" }, { month: "asc" }] }),
    prisma.savingsGoal.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.recurringTransaction.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.pushSubscription.count({ where }),
    prisma.receipt.findMany({ where: { transaction: { userId } }, select: { transactionId: true, mimeType: true, size: true, createdAt: true, data: true } }),
  ])

  const { accounts: logins, ...profile } = user
  return plain({
    exportedAt: new Date(),
    format: "clarifi-export/1",
    profile: { ...profile, signInMethods: logins.map(l => l.provider) },
    accounts,
    categories,
    transactions,
    budgets,
    savingsGoals,
    subscriptions,
    recurringTransactions: recurring,
    pushDevices: devices,
    receipts: receipts.map(({ data, ...r }) => ({ ...r, dataBase64: Buffer.from(data).toString("base64") })),
  })
}

/**
 * Permanently deletes the user and, through cascades, every row they own.
 * Accounts with a password must confirm it; social-only accounts confirm by typing ELIMINAR.
 */
export async function deleteUserAccount(userId: string, input: z.infer<typeof AccountDeletion>) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } })
  if (!user) throw notFound("Usuaria/o")
  if (user.password) {
    const valid = input.password ? await bcrypt.compare(input.password, user.password) : false
    if (!valid) throw badRequest("Contraseña incorrecta", { password: ["Contraseña incorrecta"] })
  }
  await prisma.user.delete({ where: { id: userId } })
  return { deleted: true }
}
