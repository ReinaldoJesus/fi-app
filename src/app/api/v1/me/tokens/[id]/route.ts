import { ok, withUser } from "@/server/http"
import { revokeApiToken } from "@/server/services/apiTokens"

/** Revokes a token: the automations using it stop working at once. */
export const DELETE = withUser<{ id: string }>(async ({ userId, params }) => ok(await revokeApiToken(userId, params.id)))
