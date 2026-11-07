
import { ok, readJson, withUser } from "@/server/http"
import { PushSubscriptionInput, PushUnsubscribe } from "@/lib/api/schemas"
import { deletePushSubscription, listPushDevices, savePushSubscription } from "@/server/services/push"

/** Devices subscribed to push, plus whether the server can send and its VAPID public key. */
export const GET = withUser(async ({ userId }) => ok(await listPushDevices(userId)))

/** Subscribes this browser (body = PushSubscription.toJSON()). */
export const POST = withUser(async ({ req, userId }) =>
  ok(await savePushSubscription(userId, PushSubscriptionInput.parse(await readJson(req)), req.headers.get("user-agent")), 201),
)

/** Unsubscribes a device by its endpoint. */
export const DELETE = withUser(async ({ req, userId }) =>
  ok(await deletePushSubscription(userId, PushUnsubscribe.parse(await readJson(req)).endpoint)),
)
