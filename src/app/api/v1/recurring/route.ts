import { ok, readJson, withUser } from "@/server/http"
import { RecurringCreate } from "@/lib/api/schemas"
import { createRecurring, listRecurring } from "@/server/services/recurring"

export const GET = withUser(async ({ userId }) => ok(await listRecurring(userId)))

export const POST = withUser(async ({ req, userId }) =>
  ok(await createRecurring(userId, RecurringCreate.parse(await readJson(req))), 201),
)
