import { ok, readJson, withUser } from "@/server/http"
import { BudgetCopy } from "@/lib/api/schemas"
import { applySuggestedBudgets } from "@/server/services/budgets"

/** Fills every empty budget of the month with the 3-month average spent in that category. */
export const POST = withUser(async ({ req, userId }) => {
  const { month, year } = BudgetCopy.parse(await readJson(req))
  return ok(await applySuggestedBudgets(userId, month, year))
})
