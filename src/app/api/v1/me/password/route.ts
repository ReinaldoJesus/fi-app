import { ok, readJson, withUser } from "@/server/http"
import { PasswordChange } from "@/lib/api/schemas"
import { changePassword } from "@/server/services/profile"

export const POST = withUser(async ({ req, userId }) =>
  ok(await changePassword(userId, PasswordChange.parse(await readJson(req)))),
)
