"use server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function saveTheme(theme: string) {
  const session = await auth()
  if (!session?.user?.id) return
  const valid = ["light", "dark", "system"]
  if (!valid.includes(theme)) return
  await prisma.user.update({ where: { id: session.user.id }, data: { theme } })
}

export async function saveSettings(data: {
  budgetCarryOver?: boolean
  notifSubscriptions?: boolean
  notifInactivity?: boolean
  hideAmountsOnStart?: boolean
  defaultAccountId?: string | null
}) {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }
  await prisma.user.update({ where: { id: session.user.id }, data })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/profile")
  return { success: true }
}
