import { ok, readJson, withUser } from "@/server/http"
import { SavingsGoalUpdate } from "@/lib/api/schemas"
import { deleteSavingsGoal, updateSavingsGoal } from "@/server/services/savings"

type P = { id: string }

export const PATCH = withUser<P>(async ({ req, userId, params }) =>
  ok(await updateSavingsGoal(userId, params.id, SavingsGoalUpdate.parse(await readJson(req)))),
)

export const DELETE = withUser<P>(async ({ userId, params }) => ok(await deleteSavingsGoal(userId, params.id)))
