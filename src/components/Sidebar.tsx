"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { logout } from "@/app/actions/auth"
import { saveTheme } from "@/app/actions/profile"
import { useBalanceVisibility } from "@/contexts/BalanceVisibility"
import type { AppNotification } from "@/app/dashboard/layout"

type Props = { userName: string | null; userEmail: string | null; userImage: string | null; urgentSubsCount: number; dbTheme: string; notifications: AppNotification[] }

type NavItem = {
  href: string
  label: string
  mobile: boolean
  icon: (active: boolean) => React.ReactNode
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Resumen",
    mobile: true,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/accounts",
    label: "Cuentas",
    mobile: true,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <rect x="2" y="5" width="20" height="14" rx="2.5" />
        <path strokeLinecap="round" d="M2 10h20" /><path strokeLinecap="round" strokeWidth={2} d="M6 15h4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/transactions",
    label: "Transacciones",
    mobile: true,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/analytics",
    label: "Análisis",
    mobile: true,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/savings",
    label: "Metas",
    mobile: false,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/budgets",
    label: "Presupuestos",
    mobile: false,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/categories",
    label: "Categorías",
    mobile: false,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/subscriptions",
    label: "Suscripciones",
    mobile: false,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    href: "/dashboard/profile",
    label: "Perfil",
    mobile: true,
    icon: (active) => (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
        stroke="currentColor" opacity={active ? 1 : 0.45}>
        <circle cx="12" cy="8" r="4" />
        <path strokeLinecap="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

function SunIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function AutoIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="4" width="20" height="14" rx="2.5" />
      <path strokeLinecap="round" d="M8 20h8M12 18v2" />
    </svg>
  )
}

/* Animated eye — single SVG with CSS transitions */
function AnimatedEye({ visible, size = 18 }: { visible: boolean; size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Eye outline — squints (scaleY) when closed */}
      <path
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        style={{
          transformOrigin: "12px 12px",
          transform: visible ? "scaleY(1)" : "scaleY(0.1)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      {/* Iris — shrinks and fades when closed */}
      <circle
        cx="12" cy="12" r="3"
        style={{
          transformOrigin: "12px 12px",
          transform: visible ? "scale(1)" : "scale(0)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.25s ease, opacity 0.2s ease",
        }}
      />
      {/* Diagonal slash — appears when closed */}
      <line
        x1="4" y1="4" x2="20" y2="20"
        style={{
          opacity: visible ? 0 : 1,
          transition: "opacity 0.25s ease 0.1s",
        }}
      />
    </svg>
  )
}

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
        const raw = localStorage.getItem(key)
        const parsed = JSON.parse(raw ?? "[]")
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

  function toggleOpen() {
    if (!open) {
      const all = notifications.map(n => n.id)
      const next = Array.from(new Set([...dismissed, ...all]))
      setDismissed(next)
      try { localStorage.setItem("notif-dismissed", JSON.stringify(next)) } catch {}
    }
    setOpen(v => !v)
  }

  function persist(key: string, value: string[]) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
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

  if (!mounted) return null

  const visible = notifications.filter(n => !cleared.includes(n.id))
  const unread = notifications.filter(n => !dismissed.includes(n.id) && !cleared.includes(n.id)).length

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggleOpen}
        title="Notificaciones"
        className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
          open
            ? "bg-[#f5f5f7] dark:bg-white/[0.1] text-[#1d1d1f] dark:text-white"
            : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08]"
        }`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#ff3b30] rounded-full ring-1 ring-white dark:ring-[#111111] text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-[300] w-72 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.05] flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">Notificaciones</p>
            {visible.length > 0 && (
              <button onClick={clearAll}
                className="text-[11px] text-[#86868b] hover:text-[#ff3b30] transition-colors font-medium">
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
                  <button
                    onClick={() => clearOne(n.id)}
                    title="Eliminar notificación"
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

function EyeButton({ visible, onClick, className }: { visible: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={visible ? "Ocultar montos" : "Mostrar montos"}
      className={`flex items-center justify-center rounded-xl transition-all duration-200 ${
        visible
          ? "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08]"
          : "text-[#007aff] bg-[#007aff]/[0.1] hover:bg-[#007aff]/[0.15]"
      } ${className}`}
    >
      <AnimatedEye visible={visible} />
    </button>
  )
}

export default function Sidebar({ userName, userEmail, userImage, urgentSubsCount, dbTheme, notifications }: Props) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { visible, toggle } = useBalanceVisibility()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Sync DB theme on first mount (localStorage was already set by the server script)
    if (dbTheme && dbTheme !== "system") setTheme(dbTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function changeTheme(value: string) {
    setTheme(value)
    saveTheme(value)
  }

  const initial = (userName ?? userEmail ?? "U")[0].toUpperCase()

  const themes = [
    { value: "light", label: "Claro", Icon: SunIcon },
    { value: "dark", label: "Oscuro", Icon: MoonIcon },
    { value: "system", label: "Auto", Icon: AutoIcon },
  ]

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-52 flex-shrink-0 bg-white dark:bg-[#111111] border-r border-black/[0.06] dark:border-white/[0.06] h-screen sticky top-0">

        {/* Brand */}
        <div className="px-4 h-14 flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1d1d1f] dark:bg-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white dark:text-[#1d1d1f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
                <path strokeLinecap="round" d="M17 6a8 8 0 1 0 0 12" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Clarifi</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell notifications={notifications} />
            <EyeButton visible={visible} onClick={toggle} className="w-8 h-8" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            const urgent = href === "/dashboard/subscriptions" && urgentSubsCount > 0
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? "bg-[#f5f5f7] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-white"
                    : "text-[#6e6e73] dark:text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7]/70 dark:hover:bg-white/[0.04]"
                }`}>
                <div className="relative flex-shrink-0">
                  {icon(active)}
                  {urgent && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#ff3b30] rounded-full ring-1 ring-white dark:ring-[#111111]" />}
                </div>
                {label}
                {urgent && (
                  <span className="ml-auto text-[10px] font-bold bg-[#ff3b30] text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {urgentSubsCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Theme selector */}
        {mounted && (
          <div className="px-4 pb-3">
            <p className="text-[10px] font-semibold text-[#86868b] dark:text-[#636366] uppercase tracking-wide mb-2">Tema</p>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl">
              {themes.map(({ value, label, Icon }) => (
                <button key={value} onClick={() => changeTheme(value)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                    theme === value
                      ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm"
                      : "text-[#86868b] dark:text-[#636366] hover:text-[#1d1d1f] dark:hover:text-white"
                  }`}>
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User */}
        <div className="px-4 py-4 border-t border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-2.5 mb-3">
            {userImage
              ? <img src={userImage} alt="" className="w-7 h-7 rounded-full" />
              : <div className="w-7 h-7 rounded-full bg-[#1d1d1f] dark:bg-white flex items-center justify-center text-white dark:text-[#1d1d1f] text-[11px] font-semibold">{initial}</div>
            }
            <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{userName ?? userEmail}</p>
          </div>
          <form action={logout}>
            <button className="text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 dark:bg-[#111111]/90 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.06] flex">
        {NAV.filter(n => n.mobile).map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center gap-1 pt-2.5 pb-4 text-[10px] font-medium transition-colors ${
                active ? "text-[#1d1d1f] dark:text-white" : "text-[#86868b]"
              }`}>
              {icon(active)}
              {label}
            </Link>
          )
        })}
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => changeTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
            className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-4 text-[10px] font-medium text-[#86868b] dark:text-[#8e8e93]"
          >
            {theme === "dark" ? <MoonIcon /> : theme === "light" ? <SunIcon /> : <AutoIcon />}
            Tema
          </button>
        )}
        {/* Eye toggle */}
        <button
          onClick={toggle}
          className={`flex-1 flex flex-col items-center gap-1 pt-2.5 pb-4 text-[10px] font-medium transition-colors ${
            visible ? "text-[#86868b]" : "text-[#007aff]"
          }`}
        >
          <AnimatedEye visible={visible} size={18} />
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </nav>
    </>
  )
}
