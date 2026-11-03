"use server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getSubscriptions() {
  const session = await auth()
  if (!session?.user?.id) return []
  return prisma.subscription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })
}

export async function createSubscription(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  const name = (formData.get("name") as string)?.trim()
  const amount = parseFloat(formData.get("amount") as string)
  const category = (formData.get("category") as string)?.trim() || null
  const icon = (formData.get("icon") as string)?.trim() || null
  const billingDay = parseInt(formData.get("billingDay") as string) || null

  if (!name) return { error: "El nombre es obligatorio" }
  if (!amount || amount <= 0) return { error: "El monto debe ser mayor a 0" }

  await prisma.subscription.create({
    data: {
      userId: session.user.id,
      name,
      amount,
      category,
      icon,
      billingDay,
    },
  })

  revalidatePath("/dashboard/subscriptions")
}

export async function updateSubscription(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  const name = (formData.get("name") as string)?.trim()
  const amount = parseFloat(formData.get("amount") as string)
  const category = (formData.get("category") as string)?.trim() || null
  const icon = (formData.get("icon") as string)?.trim() || null
  const billingDay = parseInt(formData.get("billingDay") as string) || null

  if (!name) return { error: "El nombre es obligatorio" }
  if (!amount || amount <= 0) return { error: "El monto debe ser mayor a 0" }

  await prisma.subscription.updateMany({
    where: { id, userId: session.user.id },
    data: { name, amount, category, icon, billingDay },
  })

  revalidatePath("/dashboard/subscriptions")
}

export async function toggleSubscription(id: string, active: boolean) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  await prisma.subscription.updateMany({
    where: { id, userId: session.user.id },
    data: { active },
  })

  revalidatePath("/dashboard/subscriptions")
}

export async function deleteSubscription(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  await prisma.subscription.deleteMany({
    where: { id, userId: session.user.id },
  })

  revalidatePath("/dashboard/subscriptions")
}
