import { auth } from "@/auth"
import { listSavingsGoals } from "@/server/services/savings"
import SavingsClient from "./SavingsClient"

export default async function SavingsPage() {
  const session = await auth()
  const goals = await listSavingsGoals(session!.user!.id!)

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <SavingsClient goals={goals} />
    </div>
  )
}
