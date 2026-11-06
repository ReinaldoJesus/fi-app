"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { logout } from "@/app/actions/auth"
import { saveTheme } from "@/app/actions/profile"
import { useBalanceVisibility } from "@/contexts/BalanceVisibility"
import BrandMark from "@/components/BrandMark"
import { NAV, NAV_SECTIONS, currentNavItem, isNavActive, SunIcon, MoonIcon, AutoIcon } from "@/components/nav"
import type { AppNotification } from "@/app/dashboard/layout"

type Props = {
  userName: string | null
  userEmail: string | null
  userImage: string | null
  urgentSubsCount: number
  notifications: AppNotification[]
}

/* Animated eye — single SVG with CSS transitions */
function AnimatedEye({ visible, size = 18 }: { visible: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        style={{ transformOrigin: "12px 12px", transform: visible ? "scaleY(1)" : "scaleY(0.1)", transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <circle cx="12" cy="12" r="3"
        style={{ transformOrigin: "12px 12px", transform: visible ? "scale(1)" : "scale(0)", opacity: visible ? 1 : 0, transition: "transform 0.25s ease, opacity 0.2s ease" }}
      />
      <line x1="4" y1="4" x2="20" y2="20" style={{ opacity: visible ? 0 : 1, transition: "opacity 0.25s ease 0.1s" }} />
    </svg>
  )
}

const iconBtn = "relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
const iconBtnIdle = "text-[#6e6e73] dark:text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08]"

function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [cleared, setCleared] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const load = (key: string): string[] => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "[]")
        return Array.isArray(parsed) ? parsed : []
      } catch { return [] }
    }
    setDismissed(load("notif-dismissed"))
    setCleared(load("notif-cleared"))
  }, [])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function persist(key: string, value: string[]) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
  }

  function toggleOpen() {
    if (!open) {
      const next = Array.from(new Set([...dismissed, ...notifications.map(n => n.id)]))
      setDismissed(next)
      persist("notif-dismissed", next)
    }
    setOpen(v => !v)
  }

  function clearOne(id: string) {
    const next = [...new Set([...cleared, id])]
    setCleared(next)
    persist("notif-cleared", next)
  }

  function clearAll() {
    const next = [...new Set([...cleared, ...notifications.map(n => n.id)])]
    setCleared(next)
    persist("notif-cleared", next)
  }

  if (!mounted) return <div className="w-9 h-9" />

  const visible = notifications.filter(n => !cleared.includes(n.id))
  const unread = notifications.filter(n => !dismissed.includes(n.id) && !cleared.includes(n.id)).length

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={toggleOpen} title="Notificaciones"
        className={`${iconBtn} ${open ? "bg-[#f5f5f7] dark:bg-white/[0.1] text-[#1d1d1f] dark:text-white" : iconBtnIdle}`}>
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#ff3b30] rounded-full ring-2 ring-white dark:ring-black text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[300] w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.05] flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">Notificaciones</p>
            {visible.length > 0 && (
              <button onClick={clearAll} className="text-[11px] text-[#86868b] hover:text-[#ff3b30] transition-colors font-medium">
                Limpiar todo
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[28px] mb-2">🔔</p>
              <p className="text-[13px] text-[#86868b]">Todo en orden</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05] max-h-80 overflow-y-auto">
              {visible.map(n => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[16px] flex-shrink-0 ${
                    n.type === "SUBSCRIPTION" ? "bg-[#ff9500]/[0.12]" : "bg-[#007aff]/[0.1]"
                  }`}>
                    {n.icon ?? (n.type === "SUBSCRIPTION" ? "🔔" : "📋")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white leading-tight">{n.title}</p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">{n.body}</p>
                  </div>
                  <button onClick={() => clearOne(n.id)} title="Eliminar notificación"
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MobileMenu({ open, onClose, urgentSubsCount }: { open: boolean; onClose: () => void; urgentSubsCount: number }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  function changeTheme(value: string) {
    setTheme(value)
    saveTheme(value)
  }

  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-[400]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-[#1d1d1f] dark:bg-[#111111] text-white flex flex-col shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="px-5 h-16 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <BrandMark size={32} inverted />
            <p className="text-[15px] font-semibold">Clarifi</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/[0.08]" title="Cerrar menú">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_SECTIONS.map(section => (
            <div key={section}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em]">{section}</p>
              {NAV.filter(n => n.section === section).map(({ href, label, icon }) => {
                const active = isNavActive(pathname, href)
                const urgent = href === "/dashboard/subscriptions" && urgentSubsCount > 0
                return (
                  <Link key={href} href={href} onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium ${
                      active ? "bg-white/[0.1] text-white" : "text-white/65"
                    }`}>
                    <span className={active ? "text-[#007aff]" : "text-white/50"}>{icon}</span>
                    {label}
                    {urgent && (
                      <span className="ml-auto text-[10px] font-bold bg-[#ff3b30] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{urgentSubsCount}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="px-4 pt-3 pb-6 border-t border-white/[0.06] space-y-3">
          <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.06] rounded-xl">
            {[
              { value: "light", label: "Claro", Icon: SunIcon },
              { value: "dark", label: "Oscuro", Icon: MoonIcon },
              { value: "system", label: "Auto", Icon: AutoIcon },
            ].map(({ value, label, Icon }) => (
              <button key={value} onClick={() => changeTheme(value)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold ${
                  theme === value ? "bg-white/[0.14] text-white" : "text-white/45"
                }`}>
                <Icon />{label}
              </button>
            ))}
          </div>
          <form action={logout}>
            <button className="w-full py-2.5 rounded-xl bg-white/[0.06] text-[13px] font-semibold text-white/80">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function TopBar({ userName, userEmail, userImage, urgentSubsCount, notifications }: Props) {
  const pathname = usePathname()
  const { visible, toggle } = useBalanceVisibility()
  const [menuOpen, setMenuOpen] = useState(false)

  const todayRaw = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date())
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1)

  const current = currentNavItem(pathname)
  const initial = (userName ?? userEmail ?? "U")[0].toUpperCase()

  return (
    <>
      <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] bg-white/85 dark:bg-black/75 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="h-16 px-4 lg:px-8 flex items-center gap-3">
          {/* Mobile: menu + brand */}
          <button onClick={() => setMenuOpen(true)} title="Menú"
            className={`lg:hidden ${iconBtn} ${iconBtnIdle}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
          <div className="lg:hidden flex items-center gap-2">
            <BrandMark size={28} />
            <span className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Clarifi</span>
          </div>

          {/* Desktop: breadcrumb */}
          <div className="hidden lg:block min-w-0">
            <p className="text-[11px] text-[#86868b] font-medium">
              Banca personal <span className="mx-1 text-[#c7c7cc]">/</span> {current?.label ?? "Resumen"}
            </p>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#8e8e93]" suppressHydrationWarning>{today}</p>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <span className="hidden md:flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-full bg-[#34c759]/[0.1] text-[#248a3d] dark:text-[#34c759] text-[11px] font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path strokeLinecap="round" d="M8 11V7a4 4 0 118 0v4" />
              </svg>
              Sesión segura
            </span>
            <button onClick={toggle} title={visible ? "Ocultar saldos" : "Mostrar saldos"}
              className={`${iconBtn} ${visible ? iconBtnIdle : "text-[#007aff] bg-[#007aff]/[0.1] hover:bg-[#007aff]/[0.15]"}`}>
              <AnimatedEye visible={visible} />
            </button>
            <NotificationBell notifications={notifications} />
            <Link href="/dashboard/profile" title="Perfil" className="ml-1">
              {userImage
                ? <img src={userImage} alt="" className="w-9 h-9 rounded-full ring-2 ring-white dark:ring-black" />
                : <div className="w-9 h-9 rounded-full bg-[#1d1d1f] dark:bg-white flex items-center justify-center text-white dark:text-[#1d1d1f] text-[13px] font-semibold">{initial}</div>
              }
            </Link>
          </div>
        </div>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} urgentSubsCount={urgentSubsCount} />
    </>
  )
}
