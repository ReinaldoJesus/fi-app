import { auth } from "@/auth"
import { getBudgetMonth } from "@/server/services/budgets"
import BudgetsClient from "./BudgetsClient"

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await auth()
  const userId = session!.user!.id!
  const params = await searchParams
  const now = new Date()
  const month = Math.min(12, Math.max(1, parseInt(params.month ?? "") || now.getMonth() + 1))
  const year = parseInt(params.year ?? "") || now.getFullYear()
  const { categories, spent, budgetMap, suggested } = await getBudgetMonth(userId, month, year)

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <BudgetsClient
        categories={categories}
        spent={spent}
        budgetMap={budgetMap}
        suggested={suggested}
        month={month}
        year={year}
      />
    </div>
  )
}
