import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import SubscriptionsClient from "./SubscriptionsClient"

export default async function SubscriptionsPage() {
  const session = await auth()
  const subs = await prisma.subscription.findMany({
    where: { userId: session!.user!.id! },
    orderBy: { createdAt: "asc" },
  })

  const serialized = subs.map(s => ({
    ...s,
    amount: Number(s.amount),
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <SubscriptionsClient initialSubs={serialized} />
    </div>
  )
}
