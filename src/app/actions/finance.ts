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
  const balance = parseFloat(formData.get("balance") as string) || 0
  const color = formData.get("color") as string

  if (!name || !type) return { error: "Nombre y tipo son requeridos" }

  await prisma.finAccount.create({
    data: { name, type: type as never, balance, color, userId },
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
