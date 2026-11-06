import { ok, readJson, withUser } from "@/server/http"
import { SubscriptionUpdate } from "@/lib/api/schemas"
import { deleteSubscription, updateSubscription } from "@/server/services/subscriptions"

type P = { id: string }

export const PATCH = withUser<P>(async ({ req, userId, params }) =>
  ok(await updateSubscription(userId, params.id, SubscriptionUpdate.parse(await readJson(req)))),
)

export const DELETE = withUser<P>(async ({ userId, params }) => ok(await deleteSubscription(userId, params.id)))
