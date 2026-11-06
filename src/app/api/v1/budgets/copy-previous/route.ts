import { ok, readJson, withUser } from "@/server/http"
import { BudgetCopy } from "@/lib/api/schemas"
import { copyBudgetsFromPrevious } from "@/server/services/budgets"

export const POST = withUser(async ({ req, userId }) => {
  const { month, year } = BudgetCopy.parse(await readJson(req))
  return ok(await copyBudgetsFromPrevious(userId, month, year))
})
