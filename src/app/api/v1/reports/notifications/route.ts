import { ok, withUser } from "@/server/http"
import { getNotifications } from "@/server/services/reports"

export const GET = withUser(async ({ userId }) => ok(await getNotifications(userId)))
