import { ok, readJson, withUser } from "@/server/http"
import { ProfileUpdate } from "@/lib/api/schemas"
import { getProfile, updateProfile } from "@/server/services/profile"

export const GET = withUser(async ({ userId }) => ok(await getProfile(userId)))

export const PATCH = withUser(async ({ req, userId }) =>
  ok(await updateProfile(userId, ProfileUpdate.parse(await readJson(req)))),
)
