import { auth } from "@/auth"
import { getProfile } from "@/server/services/profile"
import { listAccounts } from "@/server/services/accounts"
import ProfileClient from "./ProfileClient"

export default async function ProfilePage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [user, allAccounts] = await Promise.all([getProfile(userId), listAccounts(userId)])
  const accounts = allAccounts.map(a => ({ id: a.id, name: a.name })).sort((x, y) => x.name.localeCompare(y.name))

  return (
    <ProfileClient
      initialSettings={{
        budgetCarryOver: user?.budgetCarryOver ?? false,
        notifSubscriptions: user?.notifSubscriptions ?? true,
        notifInactivity: user?.notifInactivity ?? true,
        notifBudget: user?.notifBudget ?? true,
        hideAmountsOnStart: user?.hideAmountsOnStart ?? false,
        defaultAccountId: user?.defaultAccountId ?? null,
      }}
      accounts={accounts}
      hasPassword={user.hasPassword}
    />
  )
}
