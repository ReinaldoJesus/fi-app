import { ok, readJson, withToken } from "@/server/http"
import { ShortcutTransaction } from "@/lib/api/schemas"
import { recordShortcutTransaction } from "@/server/services/shortcuts"

/**
 * Called by phone automations: iPhone Shortcuts (Apple Pay "Transaction", bank
 * e-mails and SMS) and Android (MacroDroid forwarding bank notifications).
 * Auth: `Authorization: Bearer <personal token>`, or the personal URL
 * POST /shortcuts/<token> (../[token]/route.ts), which needs no headers.
 * 201 = recorded; 200 = nothing to record (promotion, code, reminder…) or a repeat.
 * Plain-text answers (personal URL or `?format=text`) go straight into "Show notification".
 */
export const POST = withToken(async ({ req, userId, text }) => {
  const result = await recordShortcutTransaction(userId, ShortcutTransaction.parse(await readJson(req)))
  const status = "ignored" in result || "duplicate" in result ? 200 : 201
  if (text) return new Response(result.message, { status, headers: { "content-type": "text/plain; charset=utf-8" } })
  return ok(result, status)
})
