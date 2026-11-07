
import { ok, withUser } from "@/server/http"
import { getOnboarding } from "@/server/services/insights"

/** First-run checklist with progress (creating the account already counts). */
export const GET = withUser(async ({ userId }) => ok(await getOnboarding(userId)))
