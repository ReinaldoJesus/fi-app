import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDashboardData } from "@/app/lib/dashboard"
import { generateDueRecurring } from "@/app/actions/recurring"
import NewTransactionButton from "./components/NewTransactionButton"
import NewAccountButton from "./components/NewAccountButton"
import OnboardingBanner from "./components/OnboardingBanner"
import PrivateAmount from "@/components/PrivateAmount"

function clp(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function daysUntil(billingDay: number): number {
  const now = new Date()
  const today = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return billingDay >= today ? billingDay - today : daysInMonth - today + billingDay
}

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  await generateDueRecurring(userId)

  const [raw, userSettings] = await Promise.all([
    getDashboardData(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { defaultAccountId: true } }),
  ])

  const budgetStatus = Object.fromEntries(
    raw.budgetProgress.map(b => [b.categoryId, { budget: b.budget, spent: b.spent }])
  )
  const { checkingBalance, creditDebt, netBalance, incomeMonth, expensesMonth, recentTransactions, categories, subscriptions, budgetProgress } = raw
  const accounts = raw.accounts.map((a) => ({ ...a, balance: Number(a.balance), creditLimit: a.creditLimit ? Number(a.creditLimit) : null }))
  const activeSubs = subscriptions.map(s => ({ ...s, amount: Number(s.amount) }))
  const totalSubsMonthly = activeSubs.reduce((sum, s) => sum + s.amount, 0)

  const firstName = session!.user!.name?.split(" ")[0] ?? "Usuario"
  const netPositive = netBalance >= 0
  const savingsRate = incomeMonth > 0 ? Math.round(((incomeMonth - expensesMonth) / incomeMonth) * 100) : null
  const month = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date())

  // Upcoming subscriptions (≤ 3 days)
  const urgentSubs = activeSubs
    .filter(s => s.billingDay != null)
    .map(s => ({ ...s, days: daysUntil(s.billingDay!) }))
    .filter(s => s.days <= 3)
    .sort((a, b) => a.days - b.days)

  // Onboarding steps status
  const onboardingSteps = [
    { label: "Primera cuenta", description: "Cuenta bancaria, tarjeta o efectivo.", done: accounts.length > 0, href: "/dashboard/accounts" },
    { label: "Primer movimiento", description: "Registra un ingreso o gasto.", done: recentTransactions.length > 0, href: "/dashboard/transactions" },
    { label: "Primer presupuesto", description: "Fija un límite mensual por categoría.", done: budgetProgress.length > 0, href: "/dashboard/budgets" },
    { label: "Suscripción activa", description: "Netflix, Spotify u otro cobro fijo.", done: activeSubs.length > 0, href: "/dashboard/subscriptions" },
  ]
  const onboardingDoneCount = onboardingSteps.filter(s => s.done).length
  const onboardingComplete = onboardingDoneCount === onboardingSteps.length

  // Full-page onboarding for brand-new users
  if (accounts.length === 0) {
    const upcoming = [
      { icon: "↕", color: "#34c759", title: "Movimientos", desc: "Registra ingresos y gastos del día a día con categorías." },
      { icon: "◎", color: "#ff9500", title: "Presupuestos", desc: "Fija límites mensuales y controla en qué gastas más." },
      { icon: "🔄", color: "#007aff", title: "Recurrentes", desc: "Automatiza cobros fijos como arriendo o suscripciones." },
      { icon: "📈", color: "#af52de", title: "Analytics", desc: "Visualiza tendencias e identifica oportunidades de ahorro." },
    ]

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-16">
        {/* Hero */}
        <div className="text-center mb-12 max-w-md">
          <div className="w-[72px] h-[72px] bg-[#1d1d1f] dark:bg-white rounded-[20px] flex items-center justify-center mx-auto mb-7 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_60px_rgba(255,255,255,0.08)]">
            <svg className="w-9 h-9 text-white dark:text-[#1d1d1f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-[34px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight leading-tight">
            Bienvenido, {firstName}
          </h1>
          <p className="text-[15px] text-[#86868b] mt-3 leading-relaxed">
            Tu resumen financiero personal en un solo lugar.<br />Comencemos con lo básico.
          </p>
        </div>

        {/* Steps */}
        <div className="w-full max-w-[480px] space-y-2.5 mb-12">
          {/* Step 1 — active */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#007aff]/25 dark:border-[#007aff]/25 shadow-[0_0_0_4px_rgba(0,122,255,0.07),0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_4px_rgba(0,122,255,0.12)] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#007aff] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(0,122,255,0.35)]">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Agrega tu primera cuenta</p>
                  <span className="text-[10px] font-bold text-[#007aff] bg-[#007aff]/10 px-2 py-0.5 rounded-full tracking-wide">PASO 1</span>
                </div>
                <p className="text-[13px] text-[#86868b] mb-4">Cuenta bancaria, tarjeta de crédito o efectivo.</p>
                <NewAccountButton />
              </div>
            </div>
          </div>

          {/* Steps 2-4 — upcoming */}
          {[
            {
              num: 2, color: "#34c759",
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />,
              title: "Registra tus movimientos",
              desc: "Anota ingresos y gastos del día a día.",
            },
            {
              num: 3, color: "#ff9500",
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
              title: "Fija presupuestos mensuales",
              desc: "Controla cuánto gastas en cada categoría.",
            },
            {
              num: 4, color: "#af52de",
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
              title: "Agrega suscripciones recurrentes",
              desc: "Netflix, Spotify, gym y cobros fijos.",
            },
          ].map(s => (
            <div key={s.num} className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.06] dark:border-white/[0.05] p-5 opacity-40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}18` }}>
                  <svg className="w-5 h-5" style={{ color: s.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {s.icon}
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">{s.title}</p>
                  <p className="text-[12px] text-[#86868b] mt-0.5">{s.desc}</p>
                </div>
                <div className="ml-auto w-6 h-6 rounded-full border-2 border-[#e5e5ea] dark:border-white/[0.15] flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Feature highlights */}
        <div className="w-full max-w-[480px]">
          <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest text-center mb-4">Lo que tendrás</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {upcoming.map(f => (
              <div key={f.title} className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.06] dark:border-white/[0.05] p-4 text-center">
                <div className="w-9 h-9 rounded-xl mx-auto mb-2.5 flex items-center justify-center text-[18px]" style={{ backgroundColor: `${f.color}15` }}>
                  {f.icon}
                </div>
                <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white mb-1">{f.title}</p>
                <p className="text-[10px] text-[#86868b] leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-[#c7c7cc] mt-10">Clarifi · finanzas personales</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-5 lg:px-10 py-10 space-y-8">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Hola, {firstName}</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5 capitalize">{month}</p>
        </div>
        <NewTransactionButton accounts={accounts} categories={categories} defaultAccountId={userSettings?.defaultAccountId} budgetStatus={budgetStatus} />
      </div>

      {/* Onboarding progress widget */}
      {!onboardingComplete && (
        <OnboardingBanner steps={onboardingSteps} />
      )}

      {/* Subscription alerts */}
      {urgentSubs.length > 0 && (
        <div className="bg-[#ff9500]/[0.08] border border-[#ff9500]/[0.2] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <svg className="w-4 h-4 text-[#ff9500] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-[13px] font-semibold text-[#b36d00] dark:text-[#ff9500]">
              {urgentSubs.length === 1 ? "Cobro próximo" : `${urgentSubs.length} cobros próximos`}
            </p>
          </div>
          <div className="space-y-1.5">
            {urgentSubs.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-[13px] text-[#86868b] flex items-center gap-1.5">
                  <span>{s.icon ?? "📦"}</span>
                  <span className="font-medium text-[#1d1d1f] dark:text-white">{s.name}</span>
                  <span>·</span>
                  <span className={s.days === 0 ? "text-[#ff3b30] font-semibold" : s.days === 1 ? "text-[#ff9500] font-medium" : "text-[#86868b]"}>
                    {s.days === 0 ? "hoy" : s.days === 1 ? "mañana" : `en ${s.days} días`}
                  </span>
                </span>
                <PrivateAmount value={clp(s.amount)} className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
              </div>
            ))}
          </div>
          <Link href="/dashboard/subscriptions"
            className="inline-block mt-3 text-[12px] text-[#ff9500] font-semibold hover:opacity-70 transition-opacity">
            Ver suscripciones →
          </Link>
        </div>
      )}

      {/* Position */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "En cuentas", value: clp(checkingBalance), cls: "text-[#1d1d1f] dark:text-white" },
          { label: "Deuda TDC", value: creditDebt > 0 ? `−${clp(creditDebt)}` : clp(0), cls: "text-[#ff3b30]" },
          {
            label: "Balance neto",
            value: netBalance === 0 ? clp(0) : netPositive ? clp(netBalance) : `−${clp(Math.abs(netBalance))}`,
            cls: netPositive ? "text-[#1d1d1f] dark:text-white" : "text-[#ff3b30]",
          },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.09] dark:border-white/[0.06]">
            <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">{label}</p>
            <PrivateAmount value={value} className={`text-[17px] font-semibold tabular-nums leading-tight ${cls}`} />
          </div>
        ))}
      </div>

      {/* Monthly */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.09] dark:border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.05]">
          <p className="text-[13px] font-medium text-[#86868b]">Este mes</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black/[0.04] dark:divide-white/[0.06]">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-[#34c759]/15 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-[#34c759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </div>
              <p className="text-[12px] text-[#86868b] font-medium">Ingresos</p>
            </div>
            <PrivateAmount value={clp(incomeMonth)} className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-[#ff3b30]/10 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
              </div>
              <p className="text-[12px] text-[#86868b] font-medium">Gastos</p>
            </div>
            <PrivateAmount value={clp(expensesMonth)} className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
            {savingsRate !== null && (
              <p className={`text-[11px] mt-1 font-medium ${savingsRate >= 0 ? "text-[#34c759]" : "text-[#ff3b30]"}`}>
                {savingsRate >= 0 ? `${savingsRate}% guardado` : `${Math.abs(savingsRate)}% sobre ingresos`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Subscriptions summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Suscripciones</p>
          <Link href="/dashboard/subscriptions" className="text-[13px] text-[#007aff] font-medium hover:opacity-70 transition-opacity">
            {activeSubs.length > 0 ? "Ver todas →" : "Agregar →"}
          </Link>
        </div>
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5">
          {activeSubs.length === 0 ? (
            <p className="text-[13px] text-[#86868b] text-center py-2">
              Sin suscripciones activas. <Link href="/dashboard/subscriptions" className="text-[#007aff] font-medium">Agregar una</Link>
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Activas</p>
                  <p className="text-[28px] font-semibold text-[#1d1d1f] dark:text-white leading-none">{activeSubs.length}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Por mes</p>
                  <PrivateAmount value={clp(totalSubsMonthly)} className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Al año</p>
                  <PrivateAmount value={clp(totalSubsMonthly * 12)} className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
                </div>
              </div>
              {urgentSubs.length > 0 && (
                <div className="pt-3.5 border-t border-black/[0.05] dark:border-white/[0.05] space-y-2">
                  {urgentSubs.map(s => (
                    <div key={s.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[12px]">
                        <span>{s.icon ?? "📦"}</span>
                        <span className="font-medium text-[#1d1d1f] dark:text-white">{s.name}</span>
                        <span className={`font-semibold ${s.days === 0 ? "text-[#ff3b30]" : "text-[#ff9500]"}`}>
                          · {s.days === 0 ? "hoy" : s.days === 1 ? "mañana" : `en ${s.days} días`}
                        </span>
                      </span>
                      <PrivateAmount value={clp(s.amount)} className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Budget progress */}
      {budgetProgress.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Presupuestos del mes</p>
            <Link href="/dashboard/budgets" className="text-[13px] text-[#007aff] font-medium hover:opacity-70 transition-opacity">
              Ver todos →
            </Link>
          </div>
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {budgetProgress.slice(0, 5).map(b => {
              const barColor = b.pct >= 100 ? "#ff3b30" : b.pct >= 80 ? "#ff9500" : "#34c759"
              return (
                <div key={b.categoryId} className="px-4 py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">{b.icon ?? "📦"}</span>
                      <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">{b.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: barColor }}>
                        {b.pct}%
                      </span>
                      <span className="text-[11px] text-[#86868b] ml-1.5">
                        <PrivateAmount value={`${clp(b.spent)} / ${clp(b.budget)}`} />
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${b.pct}%`, backgroundColor: barColor }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Últimas transacciones</p>
          <Link href="/dashboard/transactions" className="text-[13px] text-[#007aff] font-medium hover:opacity-70 transition-opacity">
            Ver todas →
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] px-5 py-10 text-center">
            <p className="text-[#86868b] text-sm">Sin transacciones aún</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none divide-y divide-black/[0.06] dark:divide-white/[0.05]">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0"
                  style={{ backgroundColor: tx.category?.color ? `${tx.category.color}18` : "#f5f5f7" }}>
                  {tx.category?.icon ?? (tx.type === "INCOME" ? "↑" : "↓")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{tx.description ?? tx.category?.name ?? "Sin descripción"}</p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">
                    {tx.account.name} · {new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(tx.date))}
                  </p>
                </div>
                <PrivateAmount
                  value={`${tx.type === "INCOME" ? "+" : "−"}${clp(Number(tx.amount))}`}
                  className={`text-[13px] font-semibold tabular-nums flex-shrink-0 ${tx.type === "INCOME" ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
