import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getTransactionsData } from "@/app/lib/dashboard"
import { generateDueRecurring } from "@/app/actions/recurring"
import TransactionsClient from "./TransactionsClient"

export default async function TransactionsPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  await generateDueRecurring(userId)

  const [raw, userSettings, recurringList] = await Promise.all([
    getTransactionsData(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { defaultAccountId: true } }),
    prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, type: true, amount: true, description: true, dayOfMonth: true, active: true,
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, icon: true } },
      },
    }),
  ])

  const transactions = raw.transactions.map(t => ({
    ...t,
    amount: Number(t.amount),
    date: t.date.toISOString(),
  }))

  const accounts = raw.accounts.map(a => ({ ...a, balance: Number(a.balance) }))
  const recurring = recurringList.map(r => ({ ...r, amount: Number(r.amount) }))

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
