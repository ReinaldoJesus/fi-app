import { ok, readJson, withUser } from "@/server/http"
import { AccountDeletion, ProfileUpdate } from "@/lib/api/schemas"
import { getProfile, updateProfile } from "@/server/services/profile"
import { deleteUserAccount } from "@/server/services/privacy"

export const GET = withUser(async ({ userId }) => ok(await getProfile(userId)))

export const PATCH = withUser(async ({ req, userId }) =>
  ok(await updateProfile(userId, ProfileUpdate.parse(await readJson(req)))),
)

/** Permanently deletes the account and all its data. The client should sign out afterwards. */
export const DELETE = withUser(async ({ req, userId }) =>
  ok(await deleteUserAccount(userId, AccountDeletion.parse(await readJson(req)))),
)
