import { ok, readJson, withToken } from "@/server/http"
import { ShortcutTransaction } from "@/lib/api/schemas"
import { recordShortcutTransaction } from "@/server/services/shortcuts"

/**
 * Called by the iPhone Shortcuts "Transaction" automation after an Apple Pay
 * payment. Auth: `Authorization: Bearer <personal token>`, or the personal URL
 * POST /shortcuts/<token> (../[token]/route.ts), which needs no headers.
 * Plain-text answers (personal URL or `?format=text`) go straight into "Show notification".
 */
export const POST = withToken(async ({ req, userId, text }) => {
  const result = await recordShortcutTransaction(userId, ShortcutTransaction.parse(await readJson(req)))
  if (text) return new Response(result.message, { status: 201, headers: { "content-type": "text/plain; charset=utf-8" } })
  return ok(result, 201)
})
