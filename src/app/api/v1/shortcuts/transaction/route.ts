import { ok, readJson, withToken } from "@/server/http"
import { ShortcutTransaction } from "@/lib/api/schemas"
import { recordShortcutTransaction } from "@/server/services/shortcuts"

/**
 * Called by the iPhone Shortcuts "Transaction" automation after an Apple Pay
 * payment. Auth: `Authorization: Bearer <personal token>`.
 * `?format=text` answers with just the message, ready for "Show notification".
 */
export const POST = withToken(async ({ req, userId }) => {
  const result = await recordShortcutTransaction(userId, ShortcutTransaction.parse(await readJson(req)))
  if (new URL(req.url).searchParams.get("format") === "text") {
    return new Response(result.message, { status: 201, headers: { "content-type": "text/plain; charset=utf-8" } })
  }
  return ok(result, 201)
})
