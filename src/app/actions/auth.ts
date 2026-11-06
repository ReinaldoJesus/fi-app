"use server"
/**
 * Session flows only. NextAuth's sign-in/sign-out must run on the server to set
 * the session cookie, so these stay as server actions; everything else in the
 * app goes through /api/v1. Registration delegates to the same service as
 * POST /api/v1/auth/register.
 */
import { signIn, signOut } from "@/auth"
import { AuthError } from "next-auth"
import { Register } from "@/lib/api/schemas"
import { registerUser } from "@/server/services/profile"
import { ApiError } from "@/server/errors"

type SignupState = { errors?: Record<string, string[] | undefined>; message?: string } | undefined

export async function loginWithCredentials(_prev: { error: string } | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) return { error: "Email o contraseña incorrectos" }
    throw error
  }
}

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = Register.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const errors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) (errors[String(issue.path[0])] ??= []).push(issue.message)
    return { errors }
  }

  try {
    await registerUser(parsed.data)
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
