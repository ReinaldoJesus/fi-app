"use server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createSavingsGoal(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  const userId = session.user.id

  const name = formData.get("name") as string
  const targetAmount = parseFloat(formData.get("targetAmount") as string)
  const currentAmount = parseFloat(formData.get("currentAmount") as string) || 0
  const icon = (formData.get("icon") as string) || null
  const color = (formData.get("color") as string) || "#34c759"
  const deadlineStr = formData.get("deadline") as string

  if (!name || !targetAmount || targetAmount <= 0) return { error: "Datos inválidos" }

  await prisma.savingsGoal.create({
    data: {
      userId, name, targetAmount, currentAmount, icon, color,
      deadline: deadlineStr ? new Date(deadlineStr) : null,
    },
  })
  revalidatePath("/dashboard/savings")
}

export async function updateSavingsGoal(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  const name = formData.get("name") as string
  const targetAmount = parseFloat(formData.get("targetAmount") as string)
  const icon = (formData.get("icon") as string) || null
  const color = (formData.get("color") as string) || "#34c759"
  const deadlineStr = formData.get("deadline") as string

  if (!name || !targetAmount || targetAmount <= 0) return { error: "Datos inválidos" }

  await prisma.savingsGoal.updateMany({
    where: { id, userId: session.user.id },
    data: {
      name, targetAmount, icon, color,
      deadline: deadlineStr ? new Date(deadlineStr) : null,
    },
  })
  revalidatePath("/dashboard/savings")
}

export async function contributeToGoal(id: string, amount: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: session.user.id } })
  if (!goal) return { error: "Meta no encontrada" }

  const newAmount = Number(goal.currentAmount) + amount
  const completed = newAmount >= Number(goal.targetAmount)

  await prisma.savingsGoal.update({
    where: { id },
    data: { currentAmount: newAmount, completed },
  })
  revalidatePath("/dashboard/savings")
}

export async function deleteSavingsGoal(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  await prisma.savingsGoal.deleteMany({ where: { id, userId: session.user.id } })
  revalidatePath("/dashboard/savings")
}
