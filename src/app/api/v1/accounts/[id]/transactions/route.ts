import { ok, readQuery, withUser } from "@/server/http"
import { TransactionListQuery } from "@/lib/api/schemas"
import { getAccount } from "@/server/services/accounts"
import { listTransactions } from "@/server/services/transactions"

/** Movements of one account (as origin or transfer destination), newest first. */
export const GET = withUser<{ id: string }>(async ({ req, userId, params }) => {
  await getAccount(userId, params.id)
  const q = TransactionListQuery.parse({ ...readQuery(req), accountId: params.id })
  return ok(await listTransactions(userId, q))
})
