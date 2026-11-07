
import { ok, withUser } from "@/server/http"
import { sendTestPush } from "@/server/services/push"

/** Sends a test notification to all of the user's devices. */
export const POST = withUser(async ({ userId }) => ok(await sendTestPush(userId)))
