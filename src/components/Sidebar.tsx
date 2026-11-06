"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { logout } from "@/app/actions/auth"
import SubmitOverlay from "@/components/SubmitOverlay"
import { api } from "@/lib/api/client"
import BrandMark from "@/components/BrandMark"
import { NAV, NAV_SECTIONS, isNavActive, SunIcon, MoonIcon, AutoIcon } from "@/components/nav"

type Props = {
  userName: string | null
  userEmail: string | null
  userImage: string | null
  urgentSubsCount: number
  dbTheme: string
}

export default function Sidebar({ userName, userEmail, userImage, urgentSubsCount, dbTheme }: Props) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (dbTheme && dbTheme !== "system") setTheme(dbTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function changeTheme(value: string) {
    setTheme(value)
    api.me.update({ theme: value as "light" | "dark" | "system" })
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
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-[#1d1d1f] dark:bg-[#111111] dark:border-r dark:border-white/[0.06] h-screen sticky top-0 text-white">

        {/* Brand */}
        <div className="px-5 h-16 flex items-center gap-3 border-b border-white/[0.06]">
          <BrandMark size={34} inverted />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">Clarifi</p>
            <p className="text-[10px] text-white/45 font-medium uppercase tracking-[0.12em]">Banca personal</p>
          </div>
        </div>

        {/* Customer */}
        <div className="px-4 pt-5 pb-2">
          <Link href="/dashboard/profile"
            className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] transition-colors">
            {userImage
              ? <img src={userImage} alt="" className="w-9 h-9 rounded-full" />
              : <div className="w-9 h-9 rounded-full bg-[#007aff] flex items-center justify-center text-[13px] font-semibold">{initial}</div>
            }
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate">{userName ?? "Mi cuenta"}</p>
              <p className="text-[11px] text-white/45 truncate">{userEmail}</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {NAV_SECTIONS.map(section => (
            <div key={section}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em]">{section}</p>
              <div className="space-y-0.5">
                {NAV.filter(n => n.section === section).map(({ href, label, icon }) => {
                  const active = isNavActive(pathname, href)
                  const urgent = href === "/dashboard/subscriptions" && urgentSubsCount > 0
                  return (
                    <Link key={href} href={href}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? "bg-white/[0.1] text-white"
                          : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                      }`}>
                      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#007aff]" />}
                      <span className={active ? "text-white" : "text-white/50"}>{icon}</span>
                      {label}
                      {urgent && (
                        <span className="ml-auto text-[10px] font-bold bg-[#ff3b30] text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          {urgentSubsCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 pt-3 pb-4 border-t border-white/[0.06] space-y-3">
          {mounted && (
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.06] rounded-xl">
              {themes.map(({ value, label, Icon }) => (
                <button key={value} onClick={() => changeTheme(value)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    theme === value ? "bg-white/[0.14] text-white" : "text-white/45 hover:text-white"
                  }`}>
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-[#34c759] font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path strokeLinecap="round" d="M8 11V7a4 4 0 118 0v4" />
              </svg>
              Conexión segura
            </span>
            <form action={logout}>
              <SubmitOverlay label="Cerrando sesión…" />
              <button className="flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white transition-colors font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Salir
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-[#111111]/95 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.06] flex">
        {NAV.filter(n => n.mobile).map(({ href, shortLabel, label, icon }) => {
          const active = isNavActive(pathname, href)
          return (
            <Link key={href} href={href}
              className={`relative flex-1 flex flex-col items-center gap-1 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] text-[10px] font-semibold transition-colors ${
                active ? "text-[#007aff]" : "text-[#86868b]"
              }`}>
              {active && <span className="absolute top-0 inset-x-6 h-[2px] rounded-b-full bg-[#007aff]" />}
              {icon}
              {shortLabel ?? label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
