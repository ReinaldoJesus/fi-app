import { ok, readJson, withUser } from "@/server/http"
import { AccountSetup } from "@/lib/api/schemas"
import { applySetup } from "@/server/services/setup"

/** Applies the step-by-step signup to the signed-in user (once; 409 if they already have accounts). */
export const POST = withUser(async ({ req, userId }) => ok(await applySetup(userId, AccountSetup.parse(await readJson(req))), 201))
