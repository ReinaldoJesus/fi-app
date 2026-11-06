import { ok, readJson, withUser } from "@/server/http"
import { TransactionUpdate } from "@/lib/api/schemas"
import { deleteTransaction, getTransaction, updateTransaction } from "@/server/services/transactions"

type P = { id: string }

export const GET = withUser<P>(async ({ userId, params }) => ok(await getTransaction(userId, params.id)))

export const PATCH = withUser<P>(async ({ req, userId, params }) =>
  ok(await updateTransaction(userId, params.id, TransactionUpdate.parse(await readJson(req)))),
)

export const DELETE = withUser<P>(async ({ userId, params }) => ok(await deleteTransaction(userId, params.id)))
