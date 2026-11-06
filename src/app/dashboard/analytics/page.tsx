import { auth } from "@/auth"
import { getAnalytics } from "@/server/services/reports"
import AnalyticsClient from "./AnalyticsClient"

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await auth()
  const params = await searchParams
  const period = Math.min(24, Math.max(3, parseInt(params.period ?? "6") || 6))
  const data = await getAnalytics(session!.user!.id!, period)

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <AnalyticsClient
        months={data.months}
        byCategory={data.byCategory}
        budgetMap={data.budgetMap}
        avgMonthlyExpense={data.avgMonthlyExpense}
        projectedExpense={data.projectedExpense}
        today={data.today}
        daysInMonth={data.daysInMonth}
        period={period}
        netWorth={data.netWorth}
      />
    </div>
  )
}
