
import { ok, withUser } from "@/server/http"
import { getSubscriptionsInsight } from "@/server/services/insights"

/** Monthly subscription total and its share of the average monthly income. */
export const GET = withUser(async ({ userId }) => ok(await getSubscriptionsInsight(userId)))
