import { ok, readJson, readQuery, withPublic } from "@/server/http"
import { PasswordResetRequest } from "@/lib/api/schemas"
import { checkResetToken, requestPasswordReset } from "@/server/services/passwordReset"
import { clientIp } from "@/server/rateLimit"

/** Emails a reset link. Responds 202 whether or not the email has an account. */
export const POST = withPublic(async ({ req }) => {
  const input = PasswordResetRequest.parse(await readJson(req))
  return ok(await requestPasswordReset(input, { ip: await clientIp(), origin: new URL(req.url).origin }), 202)
})

/** ?token=… → { valid } so the UI can tell an expired link before asking for a password. */
export const GET = withPublic(async ({ req }) => ok(await checkResetToken(readQuery(req).token ?? "")))
