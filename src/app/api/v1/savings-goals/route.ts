import { ok, readJson, withUser } from "@/server/http"
import { SavingsGoalCreate } from "@/lib/api/schemas"
import { createSavingsGoal, listSavingsGoals } from "@/server/services/savings"

export const GET = withUser(async ({ userId }) => ok(await listSavingsGoals(userId)))

export const POST = withUser(async ({ req, userId }) =>
  ok(await createSavingsGoal(userId, SavingsGoalCreate.parse(await readJson(req))), 201),
)
