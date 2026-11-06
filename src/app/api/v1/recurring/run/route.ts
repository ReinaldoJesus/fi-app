import { ok, withUser } from "@/server/http"
import { generateDueRecurring } from "@/server/services/recurring"

/** Creates the movements of recurring rules that are due (idempotent). */
export const POST = withUser(async ({ userId }) => ok(await generateDueRecurring(userId)))
