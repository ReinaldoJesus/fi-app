import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import Sidebar from "@/components/Sidebar"
import TopBar from "@/components/TopBar"
import { BalanceVisibilityProvider } from "@/contexts/BalanceVisibility"
import { prisma } from "@/lib/prisma"

export type AppNotification = {
  id: string
  type: "SUBSCRIPTION" | "INACTIVITY"
  title: string
  body: string
  icon: string | null
}

const fmtCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const userId = session.user.id!
  const now = new Date()
  const today = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayDateStr = now.toISOString().slice(0, 10)

  const [user, subs, todayTxCount, accountCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { theme: true, notifSubscriptions: true, notifInactivity: true, hideAmountsOnStart: true },
    }),
    prisma.subscription.findMany({
      where: { userId, active: true, billingDay: { not: null } },
      select: { id: true, name: true, billingDay: true, icon: true, amount: true },
    }),
    prisma.transaction.count({ where: { userId, date: { gte: todayStart } } }),
    prisma.finAccount.count({ where: { userId } }),
  ])

  const dbTheme = user?.theme ?? "system"

  const urgentSubsCount = subs.filter(s => {
    if (!s.billingDay) return false
    const days = s.billingDay >= today ? s.billingDay - today : daysInMonth - today + s.billingDay
    return days <= 3
  }).length

  const notifications: AppNotification[] = []

  if (user?.notifSubscriptions !== false) {
    for (const s of subs) {
      if (!s.billingDay) continue
      const days = s.billingDay >= today ? s.billingDay - today : daysInMonth - today + s.billingDay
      if (days <= 3) {
        notifications.push({
          id: `sub-${s.id}-${todayDateStr}`,
          type: "SUBSCRIPTION",
          title: days === 0 ? `${s.name} cobra hoy` : days === 1 ? `${s.name} cobra mañana` : `${s.name} cobra en ${days} días`,
          body: `${fmtCLP(Number(s.amount))}/mes`,
          icon: s.icon ?? null,
        })
      }
    }
  }

  if (user?.notifInactivity !== false && accountCount > 0 && todayTxCount === 0) {
    notifications.push({
      id: `inactivity-${todayDateStr}`,
      type: "INACTIVITY",
      title: "Sin movimientos hoy",
      body: "No has registrado ingresos ni gastos por el momento.",
      icon: null,
    })
  }

  return (
    <SessionProvider session={session}>
    <BalanceVisibilityProvider initialHidden={user?.hideAmountsOnStart ?? false}>
      <div className="flex bg-[#f2f2f7] dark:bg-black min-h-screen">
        <Sidebar
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? null}
          userImage={session.user.image ?? null}
          urgentSubsCount={urgentSubsCount}
          dbTheme={dbTheme}
        />
        <div className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <TopBar
            userName={session.user.name ?? null}
            userEmail={session.user.email ?? null}
            userImage={session.user.image ?? null}
            urgentSubsCount={urgentSubsCount}
            notifications={notifications}
          />
          {children}
        </div>
      </div>
    </BalanceVisibilityProvider>
    </SessionProvider>
  )
}
