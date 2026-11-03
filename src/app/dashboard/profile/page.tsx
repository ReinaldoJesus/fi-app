import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import ProfileClient from "./ProfileClient"

export default async function ProfilePage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        budgetCarryOver: true,
        notifSubscriptions: true,
        notifInactivity: true,
        hideAmountsOnStart: true,
        defaultAccountId: true,
      },
    }),
    prisma.finAccount.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <ProfileClient
      initialSettings={{
        budgetCarryOver: user?.budgetCarryOver ?? false,
        notifSubscriptions: user?.notifSubscriptions ?? true,
        notifInactivity: user?.notifInactivity ?? true,
        hideAmountsOnStart: user?.hideAmountsOnStart ?? false,
        defaultAccountId: user?.defaultAccountId ?? null,
      }}
      accounts={accounts}
    />
  )
}
