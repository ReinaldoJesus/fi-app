import { ok, readQuery, withUser } from "@/server/http"
import { AnalyticsQuery } from "@/lib/api/schemas"
import { getAnalytics } from "@/server/services/reports"

export const GET = withUser(async ({ req, userId }) => {
  const { months } = AnalyticsQuery.parse(readQuery(req))
  return ok(await getAnalytics(userId, months))
})
