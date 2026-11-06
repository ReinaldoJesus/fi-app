import { ok, readJson, readQuery, withUser } from "@/server/http"
import { BudgetPeriodQuery, BudgetUpsert } from "@/lib/api/schemas"
import { getBudgetMonth, upsertBudget } from "@/server/services/budgets"
import { todayParts } from "@/server/dates"

/** Budgets and spending per expense category for ?month=&year= (default: current month). */
export const GET = withUser(async ({ req, userId }) => {
  const q = BudgetPeriodQuery.parse(readQuery(req))
  const now = todayParts()
  return ok(await getBudgetMonth(userId, q.month ?? now.month, q.year ?? now.year))
})

/** Sets one category's budget for a month; amount 0 removes it. */
export const PUT = withUser(async ({ req, userId }) =>
  ok(await upsertBudget(userId, BudgetUpsert.parse(await readJson(req)))),
)
