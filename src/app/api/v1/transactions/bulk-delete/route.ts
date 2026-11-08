import { ok, readJson, withUser } from "@/server/http"
import { TransactionBulkDelete } from "@/lib/api/schemas"
import { deleteTransactions } from "@/server/services/transactions"

/** Deletes several movements at once (e.g. a whole month) and reverts the balances. */
export const POST = withUser(async ({ req, userId }) => ok(await deleteTransactions(userId, TransactionBulkDelete.parse(await readJson(req)).ids)))
