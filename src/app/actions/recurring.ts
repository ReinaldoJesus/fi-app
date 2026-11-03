"use server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createRecurring(data: {
  accountId: string
  categoryId?: string | null
  type: "INCOME" | "EXPENSE"
  amount: number
  description?: string | null
  dayOfMonth: number
}) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  if (data.amount <= 0) return { error: "El monto debe ser mayor a 0" }
  if (data.dayOfMonth < 1 || data.dayOfMonth > 28) return { error: "Día debe ser entre 1 y 28" }

  await prisma.recurringTransaction.create({
    data: {
      userId: session.user.id,
      accountId: data.accountId,
      categoryId: data.categoryId ?? null,
      type: data.type,
      amount: data.amount,
      description: data.description ?? null,
      dayOfMonth: data.dayOfMonth,
    },
  })
  revalidatePath("/dashboard/transactions")
  return { success: true }
}

export async function toggleRecurring(id: string, active: boolean) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  await prisma.recurringTransaction.updateMany({
    where: { id, userId: session.user.id },
    data: { active },
  })
  revalidatePath("/dashboard/transactions")
  return { success: true }
}

export async function deleteRecurring(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  await prisma.recurringTransaction.deleteMany({ where: { id, userId: session.user.id } })
  revalidatePath("/dashboard/transactions")
  return { success: true }
}

export async function generateDueRecurring(userId: string) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const today = now.getDate()

  const pending = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      active: true,
      NOT: { lastGeneratedMonth: month, lastGeneratedYear: year },
    },
    include: { account: true },
  })

  let generated = 0
  for (const r of pending) {
    if (r.dayOfMonth > today) continue

    const txDate = new Date(year, month - 1, r.dayOfMonth)

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          accountId: r.accountId,
          categoryId: r.categoryId,
          type: r.type,
          amount: r.amount,
          description: r.description ?? `Recurrente: ${r.description ?? ""}`,
          date: txDate,
          notes: "Generado automáticamente",
        },
      }),
      prisma.finAccount.update({
        where: { id: r.accountId },
        data: {
          balance: {
            [r.type === "INCOME" ? "increment" : "decrement"]: r.amount,
          },
        },
      }),
      prisma.recurringTransaction.update({
        where: { id: r.id },
        data: { lastGeneratedMonth: month, lastGeneratedYear: year },
      }),
    ])
    generated++
  }

  if (generated > 0) {
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/transactions")
  }
  return generated
}
