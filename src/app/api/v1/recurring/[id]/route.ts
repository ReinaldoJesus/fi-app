import { ok, readJson, withUser } from "@/server/http"
import { RecurringUpdate } from "@/lib/api/schemas"
import { deleteRecurring, setRecurringActive } from "@/server/services/recurring"

type P = { id: string }

export const PATCH = withUser<P>(async ({ req, userId, params }) => {
  const { active } = RecurringUpdate.parse(await readJson(req))
  return ok(await setRecurringActive(userId, params.id, active))
})

export const DELETE = withUser<P>(async ({ userId, params }) => ok(await deleteRecurring(userId, params.id)))
