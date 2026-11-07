
import { ok, withUser } from "@/server/http"
import { getTransactionSuggestions } from "@/server/services/insights"

/** Frequent descriptions with their usual category/account/amount, and the top category per type. */
export const GET = withUser(async ({ userId }) => ok(await getTransactionSuggestions(userId)))
