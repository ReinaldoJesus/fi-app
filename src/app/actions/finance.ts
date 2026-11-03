"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

const DEFAULT_CATEGORIES = [
  { name: "Sueldo", type: "INCOME", color: "#10b981", icon: "💼" },
  { name: "Freelance", type: "INCOME", color: "#3b82f6", icon: "💻" },
  { name: "Inversiones", type: "INCOME", color: "#8b5cf6", icon: "📈" },
  { name: "Otros ingresos", type: "INCOME", color: "#06b6d4", icon: "💰" },
  { name: "Alimentación", type: "EXPENSE", color: "#f97316", icon: "🍔" },
  { name: "Transporte", type: "EXPENSE", color: "#eab308", icon: "🚗" },
  { name: "Vivienda", type: "EXPENSE", color: "#ef4444", icon: "🏠" },
  { name: "Salud", type: "EXPENSE", color: "#ec4899", icon: "🏥" },
  { name: "Entretenimiento", type: "EXPENSE", color: "#a855f7", icon: "🎮" },
  { name: "Ropa", type: "EXPENSE", color: "#f43f5e", icon: "👕" },
  { name: "Educación", type: "EXPENSE", color: "#14b8a6", icon: "📚" },
  { name: "Otros gastos", type: "EXPENSE", color: "#6b7280", icon: "📦" },
] as const

async function ensureCategories(userId: string) {
  const count = await prisma.category.count({ where: { userId } })
  if (count > 0) return
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId, isDefault: true })),
  })
}

export async function createAccount(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autorizado")
  const userId = session.user.id

  const name = formData.get("name") as string
  const type = formData.get("type") as string
  const bank = (formData.get("bank") as string)?.trim() || null
  const color = formData.get("color") as string
  const currency = (formData.get("currency") as string) || "CLP"

  if (!name || !type) return { error: "Nombre y tipo son requeridos" }

  let balance = parseFloat(formData.get("balance") as string) || 0
  let creditLimit: number | null = null

  if (type === "CREDIT_CARD") {
    const used = parseFloat(formData.get("usedAmount") as string) || 0
    creditLimit = parseFloat(formData.get("creditLimit") as string) || null
    balance = -used
  }

  await prisma.finAccount.create({
    data: { name, type: type as never, balance, creditLimit, color, bank, currency, userId },
  })

  await ensureCategories(userId)
  revalidatePath("/dashboard")
}

export async function createTransaction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autorizado")
  const userId = session.user.id

  const type = formData.get("type") as string
  const amount = parseFloat(formData.get("amount") as string)
  const description = formData.get("description") as string
  const notes = (formData.get("notes") as string) || null
  const date = formData.get("date") as string
  const accountId = formData.get("accountId") as string
  const categoryId = formData.get("categoryId") as string

  if (!amount || amount <= 0 || !accountId) return { error: "Datos inválidos" }

  const balanceDelta = type === "INCOME" ? amount : -amount

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        type: type as never,
        amount,
        description: description || null,
        notes,
        date: date ? new Date(date) : new Date(),
        userId,
        accountId,
        categoryId: categoryId || null,
      },
    }),
    prisma.finAccount.update({
      where: { id: accountId },
      data: { balance: { increment: balanceDelta } },
    }),
  ])

  revalidatePath("/dashboard")
}

export async function updateTransaction(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  const userId = session.user.id

  const old = await prisma.transaction.findFirst({ where: { id, userId } })
  if (!old) return { error: "Transacción no encontrada" }

  const type = formData.get("type") as string
  const amount = parseFloat(formData.get("amount") as string)
  const description = formData.get("description") as string
  const notes = (formData.get("notes") as string) || null
  const date = formData.get("date") as string
  const accountId = formData.get("accountId") as string
  const categoryId = formData.get("categoryId") as string

  if (!amount || amount <= 0) return { error: "Monto inválido" }

  const revert = old.type === "INCOME" ? -Number(old.amount) : Number(old.amount)
  const apply = type === "INCOME" ? amount : -amount
  const delta = revert + apply

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id },
      data: {
        type: type as never, amount, description: description || null,
        notes,
        date: date ? new Date(date) : old.date,
        accountId, categoryId: categoryId || null,
      },
    }),
    prisma.finAccount.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    }),
  ])

  revalidatePath("/dashboard")
}

export async function deleteAccount(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  const userId = session.user.id

  const account = await prisma.finAccount.findFirst({ where: { id, userId } })
  if (!account) return { error: "Cuenta no encontrada" }

  await prisma.finAccount.delete({ where: { id } })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/accounts")
}

export async function createTransfer(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autorizado")
  const userId = session.user.id

  const fromAccountId = formData.get("fromAccountId") as string
  const toAccountId = formData.get("toAccountId") as string
  const amount = parseFloat(formData.get("amount") as string)
  const description = (formData.get("description") as string) || null
  const date = formData.get("date") as string

  if (!fromAccountId || !toAccountId || !amount || amount <= 0) return { error: "Datos inválidos" }
  if (fromAccountId === toAccountId) return { error: "Las cuentas deben ser diferentes" }

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        type: "TRANSFER", amount, description,
        date: date ? new Date(date) : new Date(),
        userId, accountId: fromAccountId, toAccountId,
      },
    }),
    prisma.finAccount.update({ where: { id: fromAccountId }, data: { balance: { decrement: amount } } }),
    prisma.finAccount.update({ where: { id: toAccountId }, data: { balance: { increment: amount } } }),
  ])
  revalidatePath("/dashboard")
}

export async function importTransactions(
  rows: { type: string; amount: number; description: string; date: string; accountId: string; categoryId?: string }[]
) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  const userId = session.user.id

  if (!rows.length) return { error: "Sin filas" }

  const ops = rows.flatMap(r => {
    const balanceDelta = r.type === "INCOME" ? r.amount : -r.amount
    return [
      prisma.transaction.create({
        data: {
          type: r.type as never, amount: r.amount,
          description: r.description || null,
          date: new Date(r.date),
          userId, accountId: r.accountId,
          categoryId: r.categoryId || null,
        },
      }),
      prisma.finAccount.update({ where: { id: r.accountId }, data: { balance: { increment: balanceDelta } } }),
    ]
  })

  await prisma.$transaction(ops)
  revalidatePath("/dashboard")
  return { imported: rows.length }
}

export async function reconcileAccount(id: string, realBalance: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  const userId = session.user.id

  const account = await prisma.finAccount.findFirst({ where: { id, userId } })
  if (!account) return { error: "Cuenta no encontrada" }

  const currentBalance = Number(account.balance)
  const delta = realBalance - currentBalance
  if (delta === 0) return { success: true, delta: 0 }

  const type = delta > 0 ? "INCOME" : "EXPENSE"
  const amount = Math.abs(delta)

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        type: type as never,
        amount,
        description: "Ajuste de saldo",
        date: new Date(),
        userId,
        accountId: id,
      },
    }),
    prisma.finAccount.update({
      where: { id },
      data: { balance: realBalance },
    }),
  ])

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/accounts")
  return { success: true, delta }
}

export async function deleteTransaction(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  const userId = session.user.id

  const tx = await prisma.transaction.findFirst({ where: { id, userId } })
  if (!tx) return { error: "Transacción no encontrada" }

  const revert = tx.type === "INCOME" ? -Number(tx.amount) : Number(tx.amount)

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    prisma.finAccount.update({
      where: { id: tx.accountId },
      data: { balance: { increment: revert } },
    }),
  ])

  revalidatePath("/dashboard")
}
