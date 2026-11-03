"use server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createCategory(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  const name = (formData.get("name") as string)?.trim()
  const type = formData.get("type") as string
  const icon = (formData.get("icon") as string)?.trim() || null
  const color = (formData.get("color") as string) || "#6366f1"

  if (!name) return { error: "Nombre requerido" }
  if (!["INCOME", "EXPENSE"].includes(type)) return { error: "Tipo inválido" }

  await prisma.category.create({
    data: { name, type: type as never, icon, color, userId: session.user.id },
  })
  revalidatePath("/dashboard/categories")
}

export async function updateCategory(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  const name = (formData.get("name") as string)?.trim()
  const icon = (formData.get("icon") as string)?.trim() || null
  const color = (formData.get("color") as string) || "#6366f1"

  if (!name) return { error: "Nombre requerido" }

  await prisma.category.updateMany({
    where: { id, userId: session.user.id },
    data: { name, icon, color },
  })
  revalidatePath("/dashboard/categories")
}

export async function deleteCategory(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  await prisma.category.deleteMany({ where: { id, userId: session.user.id } })
  revalidatePath("/dashboard/categories")
}
