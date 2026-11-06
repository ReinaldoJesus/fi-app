import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { CategoryCreate, CategoryUpdate } from "@/lib/api/schemas"
import { notFound } from "../errors"

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

export async function ensureDefaultCategories(userId: string) {
  const count = await prisma.category.count({ where: { userId } })
  if (count > 0) return
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map(c => ({ ...c, userId, isDefault: true })),
  })
}

export async function listCategories(userId: string, type?: "INCOME" | "EXPENSE") {
  return prisma.category.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: { _count: { select: { transactions: true } } },
  })
}

export async function createCategory(userId: string, input: z.infer<typeof CategoryCreate>) {
  return prisma.category.create({ data: { ...input, icon: input.icon ?? null, userId } })
}

export async function updateCategory(userId: string, id: string, input: z.infer<typeof CategoryUpdate>) {
  const existing = await prisma.category.findFirst({ where: { id, userId } })
  if (!existing) throw notFound("Categoría")
  return prisma.category.update({ where: { id }, data: input })
}

export async function deleteCategory(userId: string, id: string) {
  const existing = await prisma.category.findFirst({ where: { id, userId } })
  if (!existing) throw notFound("Categoría")
  // Movements keep existing without a category instead of blocking the delete.
  await prisma.$transaction([
    prisma.transaction.updateMany({ where: { userId, categoryId: id }, data: { categoryId: null } }),
    prisma.recurringTransaction.updateMany({ where: { userId, categoryId: id }, data: { categoryId: null } }),
    prisma.category.delete({ where: { id } }),
  ])
  return { id }
}
