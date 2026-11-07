import { ok, readJson, withPublic } from "@/server/http"
import { PasswordResetConfirm } from "@/lib/api/schemas"
import { resetPassword } from "@/server/services/passwordReset"

/** Sets a new password using the one-time token from the email. */
export const POST = withPublic(async ({ req }) => {
  const { email } = await resetPassword(PasswordResetConfirm.parse(await readJson(req)))
  return ok({ reset: true, email })
})
