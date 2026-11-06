import { ok, withUser } from "@/server/http"
import { getSummary } from "@/server/services/reports"

export const GET = withUser(async ({ userId }) => ok(await getSummary(userId)))
