"use server"
import { signIn, signOut } from "@/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SignupSchema, type FormState } from "@/app/lib/validations"
import bcrypt from "bcryptjs"

export async function loginWithCredentials(
  _prev: { error: string } | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos" }
    }
    throw error
  }
}

export async function signup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  }

  const result = SignupSchema.safeParse(raw)

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { name, email, password } = result.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { errors: { email: ["Este email ya está registrado"] } }
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: { name, email, password: hashedPassword },
  })

  await signIn("credentials", { email, password, redirectTo: "/dashboard" })
}

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function loginWithGitHub() {
  await signIn("github", { redirectTo: "/dashboard" })
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}

export async function updateProfile(
  _prev: { error?: string; success?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const { auth } = await import("@/auth")
  const { revalidatePath } = await import("next/cache")
  const session = await auth()
  if (!session?.user?.id) return { error: "No autorizado" }

  const userId = session.user.id
  const name = (formData.get("name") as string)?.trim()
  const currentPassword = formData.get("currentPassword") as string
  const newPassword = formData.get("newPassword") as string

  if (name) {
    await prisma.user.update({ where: { id: userId }, data: { name } })
  }

  if (newPassword) {
    if (!currentPassword) return { error: "Ingresa tu contraseña actual" }
    if (newPassword.length < 8) return { error: "La nueva contraseña debe tener mínimo 8 caracteres" }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.password) return { error: "Esta cuenta usa login social, no puedes cambiar contraseña" }

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return { error: "Contraseña actual incorrecta" }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  }

  revalidatePath("/dashboard/profile")
  return { success: "Cambios guardados correctamente" }
}
