import { ok, readJson, withUser } from "@/server/http"
import { SavingsContribution } from "@/lib/api/schemas"
import { contributeToGoal } from "@/server/services/savings"

/** Adds money to a goal (negative amount withdraws). */
export const POST = withUser<{ id: string }>(async ({ req, userId, params }) => {
  const { amount } = SavingsContribution.parse(await readJson(req))
  return ok(await contributeToGoal(userId, params.id, amount), 201)
})
