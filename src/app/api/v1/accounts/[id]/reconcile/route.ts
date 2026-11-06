import { ok, readJson, withUser } from "@/server/http"
import { AccountReconcile } from "@/lib/api/schemas"
import { reconcileAccount } from "@/server/services/accounts"

export const POST = withUser<{ id: string }>(async ({ req, userId, params }) => {
  const { realBalance } = AccountReconcile.parse(await readJson(req))
  return ok(await reconcileAccount(userId, params.id, realBalance))
})
