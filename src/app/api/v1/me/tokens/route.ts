import { ok, readJson, withUser } from "@/server/http"
import { ApiTokenCreate } from "@/lib/api/schemas"
import { createApiToken, listApiTokens } from "@/server/services/apiTokens"

/** Personal tokens for automations (never returns the token itself). */
export const GET = withUser(async ({ userId }) => ok(await listApiTokens(userId)))

/** Creates a token; the plain value is in this response only. */
export const POST = withUser(async ({ req, userId }) => ok(await createApiToken(userId, ApiTokenCreate.parse(await readJson(req)).name), 201))
