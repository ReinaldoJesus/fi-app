import "server-only"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { PasswordChange, ProfileUpdate, Register } from "@/lib/api/schemas"
import { badRequest, conflict, notFound } from "../errors"
import { assertAccounts } from "./guards"
import { assertRateLimit, RULES } from "../rateLimit"

const profileSelect = {
  id: true, name: true, email: true, image: true, theme: true,
  budgetCarryOver: true, notifSubscriptions: true, notifInactivity: true, notifBudget: true,
  hideAmountsOnStart: true, defaultAccountId: true, createdAt: true,
} as const

export async function getProfile(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { ...profileSelect, password: true } })
  if (!u) throw notFound("Usuaria/o")
  const { password, ...rest } = u
  return { ...rest, hasPassword: !!password, createdAt: u.createdAt.toISOString() }
}

export async function updateProfile(userId: string, input: z.infer<typeof ProfileUpdate>) {
  if (input.defaultAccountId) await assertAccounts(userId, [input.defaultAccountId])
  await prisma.user.update({ where: { id: userId }, data: input })
  return getProfile(userId)
}

export async function changePassword(userId: string, input: z.infer<typeof PasswordChange>) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } })
  if (!user?.password) throw badRequest("Esta cuenta usa login social, no puedes cambiar contraseña")
  const valid = await bcrypt.compare(input.currentPassword, user.password)
  if (!valid) throw badRequest("Contraseña actual incorrecta", { currentPassword: ["Contraseña actual incorrecta"] })
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(input.newPassword, 12) } })
  return { changed: true }
}

export async function registerUser(input: z.infer<typeof Register>, ctx: { ip: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw conflict("Este email ya está registrado", { email: ["Este email ya está registrado"] })
  // Only account creations count, so retries with a taken email don't lock anyone out.
  await assertRateLimit(`signup:ip:${ctx.ip}`, RULES.signupIp, "registros desde esta conexión")
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, password: await bcrypt.hash(input.password, 12) },
    select: { id: true, name: true, email: true },
  })
  return user
}
