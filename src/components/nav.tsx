import type { ReactNode } from "react"

export type NavSection = "Mi banco" | "Planificación" | "Herramientas" | "Configuración"

export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  section: NavSection
  mobile: boolean
  icon: ReactNode
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      {children}
    </svg>
  )
}

export const NAV_SECTIONS: NavSection[] = ["Mi banco", "Planificación", "Herramientas", "Configuración"]

export const NAV: NavItem[] = [
  {
    href: "/dashboard", label: "Resumen", section: "Mi banco", mobile: true,
    icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 4l9 6.5M5 9v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9" /></Icon>,
  },
  {
    href: "/dashboard/accounts", label: "Cuentas y tarjetas", shortLabel: "Cuentas", section: "Mi banco", mobile: true,
    icon: <Icon><rect x="2" y="5" width="20" height="14" rx="2.5" /><path strokeLinecap="round" d="M2 10h20" /><path strokeLinecap="round" strokeWidth={2} d="M6 15h4" /></Icon>,
  },
  {
    href: "/dashboard/transactions", label: "Movimientos", section: "Mi banco", mobile: true,
    icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></Icon>,
  },
  {
    href: "/dashboard/budgets", label: "Presupuestos", section: "Planificación", mobile: false,
    icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></Icon>,
  },
  {
    href: "/dashboard/savings", label: "Metas de ahorro", section: "Planificación", mobile: false,
    icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></Icon>,
  },
  {
    href: "/dashboard/subscriptions", label: "Suscripciones", section: "Planificación", mobile: false,
    icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></Icon>,
  },
  {
    href: "/dashboard/analytics", label: "Análisis", section: "Herramientas", mobile: true,
    icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></Icon>,
  },
  {
    href: "/dashboard/categories", label: "Categorías", section: "Herramientas", mobile: false,
    icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></Icon>,
  },
  {
    href: "/dashboard/profile", label: "Perfil y ajustes", shortLabel: "Perfil", section: "Configuración", mobile: true,
    icon: <Icon><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7" /></Icon>,
  },
]

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(href + "/")
}

export function currentNavItem(pathname: string) {
  return NAV.find(n => isNavActive(pathname, n.href))
}

export function SunIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

export function AutoIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="4" width="20" height="14" rx="2.5" />
      <path strokeLinecap="round" d="M8 20h8M12 18v2" />
    </svg>
  )
}
