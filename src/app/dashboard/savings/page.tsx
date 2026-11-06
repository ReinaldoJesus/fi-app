import { auth } from "@/auth"
import { getSavingsData } from "@/app/lib/dashboard"
import SavingsClient from "./SavingsClient"

export default async function SavingsPage() {
  const session = await auth()
  const raw = await getSavingsData(session!.user!.id!)
  const goals = raw.map(g => ({
    ...g,
    targetAmount: Number(g.targetAmount),
    currentAmount: Number(g.currentAmount),
    deadline: g.deadline ? g.deadline.toISOString() : null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <SavingsClient goals={goals} />
    </div>
  )
}
