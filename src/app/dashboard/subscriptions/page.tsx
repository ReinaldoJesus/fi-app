import { auth } from "@/auth"
import { listSubscriptions } from "@/server/services/subscriptions"
import { getSubscriptionsInsight } from "@/server/services/insights"
import SubscriptionsClient from "./SubscriptionsClient"

export default async function SubscriptionsPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const [serialized, insight] = await Promise.all([listSubscriptions(userId), getSubscriptionsInsight(userId)])

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <SubscriptionsClient initialSubs={serialized} shareOfIncome={insight.shareOfIncome} />
    </div>
  )
}
