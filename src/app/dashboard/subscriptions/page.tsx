import { auth } from "@/auth"
import { listSubscriptions } from "@/server/services/subscriptions"
import SubscriptionsClient from "./SubscriptionsClient"

export default async function SubscriptionsPage() {
  const session = await auth()
  const serialized = await listSubscriptions(session!.user!.id!)

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <SubscriptionsClient initialSubs={serialized} />
    </div>
  )
}
