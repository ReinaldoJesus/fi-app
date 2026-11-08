"use server"
/**
 * Session flows only. NextAuth's sign-in/sign-out must run on the server to set
 * the session cookie, so these stay as server actions; everything else in the
 * app goes through /api/v1. Registration delegates to the same service as
 * POST /api/v1/auth/register.
 */
import { signIn, signOut } from "@/auth"
import { AuthError, CredentialsSignin } from "next-auth"
import { Register } from "@/lib/api/schemas"
import { registerUser } from "@/server/services/profile"
import { ApiError } from "@/server/errors"
import { clientIp } from "@/server/rateLimit"

type SignupState = { errors?: Record<string, string[] | undefined>; message?: string } | undefined

export async function loginWithCredentials(_prev: { error: string } | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate_limited") {
      return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo, o recupera tu contraseña." }
    }
    if (error instanceof AuthError) return { error: "Email o contraseña incorrectos" }
    throw error
  }
}

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const raw: Record<string, unknown> = Object.fromEntries(formData)
  // The step-by-step signup sends what the person built as JSON in "setup".
  if (typeof raw.setup === "string") {
    try { raw.setup = raw.setup ? JSON.parse(raw.setup) : undefined } catch { raw.setup = undefined }
  }
  const parsed = Register.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) (errors[String(issue.path[0])] ??= []).push(issue.message)
    return { errors }
  }

  try {
    await registerUser(parsed.data, { ip: await clientIp() })
  } catch (err) {
    if (err instanceof ApiError) return { errors: err.fields, message: err.fields ? undefined : err.message }
    throw err
  }

  await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirectTo: "/dashboard" })
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
