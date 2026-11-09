import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import Sidebar from "@/components/Sidebar"
import TopBar from "@/components/TopBar"
import { OfflineBanner } from "@/components/ServiceWorker"
import PendingSetup from "@/components/PendingSetup"
import RefreshOnFocus from "@/components/RefreshOnFocus"
import { BalanceVisibilityProvider } from "@/contexts/BalanceVisibility"
import { getNotifications } from "@/server/services/reports"
import { getWhatsAppStatus } from "@/server/services/whatsapp"
import WhatsAppFab from "@/components/WhatsAppFab"

export type { AppNotification } from "@/server/services/reports"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const userId = session.user.id!
  const [shell, whatsapp] = await Promise.all([getNotifications(userId), getWhatsAppStatus(userId)])
  const dbTheme = shell.theme
  const urgentSubsCount = shell.urgentSubscriptionsCount
  const notifications = shell.notifications
  const user = { hideAmountsOnStart: shell.hideAmountsOnStart }

  return (
    <SessionProvider session={session}>
    <BalanceVisibilityProvider initialHidden={user?.hideAmountsOnStart ?? false}>
      <div className="flex bg-[#f2f2f7] dark:bg-black min-h-screen">
        <Sidebar
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? null}
          userImage={session.user.image ?? null}
          provider={session.user.provider}
          urgentSubsCount={urgentSubsCount}
          dbTheme={dbTheme}
        />
        <div className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <OfflineBanner />
          <PendingSetup />
          <RefreshOnFocus />
          <TopBar
            userName={session.user.name ?? null}
            userEmail={session.user.email ?? null}
            userImage={session.user.image ?? null}
            provider={session.user.provider}
            urgentSubsCount={urgentSubsCount}
            notifications={notifications}
          />
          {children}
        </div>
        {whatsapp.enabled && whatsapp.botNumber && <WhatsAppFab botNumber={whatsapp.botNumber} linked={whatsapp.linked} />}
      </div>
    </BalanceVisibilityProvider>
    </SessionProvider>
  )
}
