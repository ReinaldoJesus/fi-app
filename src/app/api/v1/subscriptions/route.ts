import { ok, readJson, readQuery, withUser } from "@/server/http"
import { SubscriptionCreate } from "@/lib/api/schemas"
import { createSubscription, listSubscriptions } from "@/server/services/subscriptions"

export const GET = withUser(async ({ req, userId }) =>
  ok(await listSubscriptions(userId, { activeOnly: readQuery(req).active === "true" })),
)

export const POST = withUser(async ({ req, userId }) =>
  ok(await createSubscription(userId, SubscriptionCreate.parse(await readJson(req))), 201),
)
