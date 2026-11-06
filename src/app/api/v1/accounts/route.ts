import { ok, readJson, withUser } from "@/server/http"
import { AccountCreate } from "@/lib/api/schemas"
import { createAccount, listAccounts } from "@/server/services/accounts"

export const GET = withUser(async ({ userId }) => ok(await listAccounts(userId)))

export const POST = withUser(async ({ req, userId }) =>
  ok(await createAccount(userId, AccountCreate.parse(await readJson(req))), 201),
)
