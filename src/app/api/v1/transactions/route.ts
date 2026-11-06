import { ok, readJson, readQuery, withUser } from "@/server/http"
import { TransactionCreate, TransactionListQuery } from "@/lib/api/schemas"
import { createTransaction, listTransactions } from "@/server/services/transactions"

/** Filters: from, to (YYYY-MM-DD), accountId, categoryId, type; paginate with limit + cursor. */
export const GET = withUser(async ({ req, userId }) =>
  ok(await listTransactions(userId, TransactionListQuery.parse(readQuery(req)))),
)

export const POST = withUser(async ({ req, userId }) =>
  ok(await createTransaction(userId, TransactionCreate.parse(await readJson(req))), 201),
)
