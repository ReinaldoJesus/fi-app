import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { PasswordResetConfirm, PasswordResetRequest } from "@/lib/api/schemas"
import { ApiError } from "../errors"
import { assertRateLimit, RULES } from "../rateLimit"
import { emailLayout, sendEmail } from "../email"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

/**
 * Emails a one-time reset link. Always resolves the same way whether or not
 * the email exists, so the endpoint can't be used to discover accounts.
 */
export async function requestPasswordReset(
  input: z.infer<typeof PasswordResetRequest>,
  ctx: { ip: string; origin: string },
) {
  await assertRateLimit(`reset:ip:${ctx.ip}`, RULES.resetIp, "solicitudes")
  await assertRateLimit(`reset:email:${input.email}`, RULES.resetEmail, "solicitudes para este email")

  const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, name: true, password: true } })
  if (user) {
    const token = randomBytes(32).toString("base64url")
    await prisma.$transaction([
      // Only the newest link works.
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      }),
    ])
    const url = `${ctx.origin}/reset-password?token=${token}`
    const { html, text } = emailLayout({
      title: user.password ? "Restablece tu contraseña" : "Crea una contraseña para Clarifi",
      intro: `Hola${user.name ? ` ${user.name}` : ""}, recibimos una solicitud para ${user.password ? "restablecer" : "crear"} la contraseña de tu cuenta. El enlace vence en 1 hora y sirve una sola vez.`,
      cta: { label: user.password ? "Restablecer contraseña" : "Crear contraseña", url },
      footer: "Si no fuiste tú, ignora este correo: tu contraseña no cambiará.",
    })
    await sendEmail({ to: input.email, subject: "Restablece tu contraseña de Clarifi", html, text })
  }
  return { sent: true }
}

/** Checks a link before showing the form, so an expired link says so up front. */
export async function checkResetToken(token: string) {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } })
  return { valid: !!row && !row.usedAt && row.expiresAt > new Date() }
}

export async function resetPassword(input: z.infer<typeof PasswordResetConfirm>) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { user: { select: { email: true } } },
  })
  if (!row || row.usedAt || row.expiresAt <= new Date()) {
    throw new ApiError(400, "invalid_token", "El enlace venció o ya fue usado. Pide uno nuevo.")
  }
  const password = await bcrypt.hash(input.password, 12)
  // Mark used conditionally so two concurrent submits can't both succeed.
  const claimed = await prisma.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } })
  if (!claimed.count) throw new ApiError(400, "invalid_token", "El enlace venció o ya fue usado. Pide uno nuevo.")
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { password } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
    // A fresh password should also lift any login lockout on the account.
    prisma.rateLimit.deleteMany({ where: { key: `login:email:${row.user.email.toLowerCase()}` } }),
  ])
  return { reset: true, email: row.user.email }
}
