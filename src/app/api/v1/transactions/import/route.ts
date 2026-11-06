import { ok, readJson, withUser } from "@/server/http"
import { TransactionImport } from "@/lib/api/schemas"
import { importTransactions } from "@/server/services/transactions"

export const POST = withUser(async ({ req, userId }) =>
  ok(await importTransactions(userId, TransactionImport.parse(await readJson(req))), 201),
)
