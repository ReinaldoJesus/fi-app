import { ok, readJson, withUser } from "@/server/http"
import { AccountUpdate } from "@/lib/api/schemas"
import { deleteAccount, getAccount, updateAccount } from "@/server/services/accounts"

type P = { id: string }

export const GET = withUser<P>(async ({ userId, params }) => ok(await getAccount(userId, params.id)))

export const PATCH = withUser<P>(async ({ req, userId, params }) =>
  ok(await updateAccount(userId, params.id, AccountUpdate.parse(await readJson(req)))),
)

export const DELETE = withUser<P>(async ({ userId, params }) => ok(await deleteAccount(userId, params.id)))
