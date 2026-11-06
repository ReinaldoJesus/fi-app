import { auth } from "@/auth"
import { getTransactionsOverview } from "@/server/services/transactions"
import { generateDueRecurring, listRecurring } from "@/server/services/recurring"
import { getProfile } from "@/server/services/profile"
import TransactionsClient from "./TransactionsClient"

export default async function TransactionsPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  await generateDueRecurring(userId)

  const [raw, userSettings, recurring] = await Promise.all([
    getTransactionsOverview(userId),
    getProfile(userId),
    listRecurring(userId),
  ])
  const { transactions, accounts } = raw

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
      <TransactionsClient
        initialTransactions={transactions}
        accounts={accounts}
        categories={raw.categories}
        defaultAccountId={userSettings?.defaultAccountId}
        budgetStatus={raw.budgetStatus}
        initialRecurring={recurring}
      />
    </div>
  )
}
