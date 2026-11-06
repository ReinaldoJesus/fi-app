import type { ReactNode } from "react"
import BrandMark from "@/components/BrandMark"

const FEATURES = [
  { color: "#34c759", title: "Todas tus cuentas en un lugar", desc: "Cuentas corrientes, ahorro, tarjetas y efectivo." },
  { color: "#007aff", title: "Control de tu presupuesto", desc: "Límites mensuales por categoría y alertas." },
  { color: "#ff9500", title: "Cobros bajo control", desc: "Suscripciones y movimientos recurrentes." },
]

export default function AuthShell({ title, subtitle, children, footer }: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-[#f2f2f7] dark:bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">

      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#1d1d1f] dark:bg-[#111111] text-white p-12">
        <div className="pointer-events-none absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#007aff]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 w-[26rem] h-[26rem] rounded-full bg-[#34c759]/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <BrandMark size={40} inverted />
          <div className="leading-tight">
            <p className="text-[18px] font-semibold tracking-tight">Clarifi</p>
            <p className="text-[10px] text-white/45 font-semibold uppercase tracking-[0.14em]">Banca personal</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[38px] font-semibold leading-[1.1] tracking-tight">
            Tus finanzas,<br />con la claridad de un banco.
          </h2>
          <p className="mt-4 text-[15px] text-white/55 leading-relaxed">
            Saldos, tarjetas, presupuestos y metas de ahorro en una sola banca personal.
          </p>

          <div className="mt-10 space-y-4">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}26` }}>
                  <svg className="w-4 h-4" style={{ color: f.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div>
                  <p className="text-[14px] font-semibold">{f.title}</p>
                  <p className="text-[13px] text-white/50">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[12px] text-white/45">
          <svg className="w-3.5 h-3.5 text-[#34c759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path strokeLinecap="round" d="M8 11V7a4 4 0 118 0v4" />
          </svg>
          Conexión cifrada · Tus datos son solo tuyos
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <BrandMark size={40} />
            <div className="leading-tight">
              <p className="text-[18px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Clarifi</p>
              <p className="text-[10px] text-[#86868b] font-semibold uppercase tracking-[0.14em]">Banca personal</p>
            </div>
          </div>

          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">{title}</h1>
          <p className="text-[14px] text-[#86868b] mt-1 mb-7">{subtitle}</p>

          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none p-7">
            {children}
          </div>

          {footer && <div className="mt-6">{footer}</div>}

          <p className="mt-8 flex items-center gap-1.5 text-[11px] text-[#86868b]">
            <svg className="w-3 h-3 text-[#34c759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path strokeLinecap="round" d="M8 11V7a4 4 0 118 0v4" />
            </svg>
            Nunca te pediremos tu contraseña por correo · © 2026 Clarifi
          </p>
        </div>
      </main>
    </div>
  )
}
