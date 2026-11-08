import Link from "next/link"
import { auth } from "@/auth"
import { getSummary } from "@/server/services/reports"
import { generateDueRecurring } from "@/server/services/recurring"
import { getOnboarding } from "@/server/services/insights"
import { getUserCountry } from "@/server/services/profile"
import NewTransactionButton from "./components/NewTransactionButton"
import NewAccountButton from "./components/NewAccountButton"
import OnboardingBanner from "./components/OnboardingBanner"
import NewTransferButton from "./components/NewTransferButton"
import PrivateAmount from "@/components/PrivateAmount"
import ProductIcon from "@/components/ProductIcon"
import { QuickActionContent, quickActionCls } from "@/components/QuickAction"
import { card, sectionTitle, eyebrow, linkAction, ACCOUNT_TYPE_LABEL } from "@/lib/ui"
import { fmtCurrency } from "@/lib/fmt"

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

  const raw = await getSummary(userId)
  const userSettings = { defaultAccountId: raw.defaultAccountId }

  const budgetStatus = Object.fromEntries(
    raw.budgetProgress.map(b => [b.categoryId, { budget: b.budget, spent: b.spent }])
  )
  const { checkingBalance, creditDebt, netBalance, incomeMonth, expensesMonth, recentTransactions, categories, subscriptions, budgetProgress } = raw
  const accounts = raw.accounts
  const activeSubs = subscriptions
  const totalSubsMonthly = activeSubs.reduce((sum, s) => sum + s.amount, 0)

  const firstName = session!.user!.name?.split(" ")[0] ?? "Usuario"
  const netPositive = netBalance >= 0
  const savingsRate = incomeMonth > 0 ? Math.round(((incomeMonth - expensesMonth) / incomeMonth) * 100) : null
  const month = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date())

  // Onboarding steps status
  const [onboarding, country] = await Promise.all([getOnboarding(userId), getUserCountry(userId)])

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
          {/* Progress: signing up already counts, so it never starts at zero */}
          <div className="px-1 pb-1">
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="font-semibold text-[#1d1d1f] dark:text-white">Tu Clarifi está {onboarding.percent}% listo</span>
              <span className="text-[#86868b]">{onboarding.done} de {onboarding.total} pasos</span>
            </div>
            <div className="h-1.5 bg-[#e5e5ea] dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full bg-[#34c759] rounded-full" style={{ width: `${onboarding.percent}%` }} />
            </div>
          </div>

          {/* Step 1 — done */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#34c759]/25 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#34c759] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">Crear tu cuenta Clarifi</p>
              <p className="text-[12px] text-[#34c759] font-medium mt-0.5">Listo</p>
            </div>
          </div>

          {/* Step 2 — active */}
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
                  <span className="text-[10px] font-bold text-[#007aff] bg-[#007aff]/10 px-2 py-0.5 rounded-full tracking-wide">PASO 2</span>
                </div>
                <p className="text-[13px] text-[#86868b] mb-4">Cuenta bancaria, tarjeta de crédito o efectivo.</p>
                <NewAccountButton country={country} />
              </div>
            </div>
          </div>

          {/* Steps 3-5 — upcoming */}
          {[
            {
              num: 3, color: "#34c759",
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />,
              title: "Registra tus movimientos",
              desc: "Anota ingresos y gastos del día a día.",
            },
            {
              num: 4, color: "#ff9500",
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
              title: "Fija presupuestos mensuales",
              desc: "Controla cuánto gastas en cada categoría.",
            },
            {
              num: 5, color: "#af52de",
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


  const hour = Number(new Intl.DateTimeFormat("es-CL", { hour: "numeric", hour12: false, timeZone: "America/Santiago" }).format(new Date()))
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches"

  const productGroups = [
    { title: "Cuentas", items: accounts.filter(a => a.type === "CHECKING" || a.type === "SAVINGS" || a.type === "CASH") },
    { title: "Tarjetas de crédito", items: accounts.filter(a => a.type === "CREDIT_CARD") },
    { title: "Inversiones", items: accounts.filter(a => a.type === "INVESTMENT") },
  ].filter(g => g.items.length > 0)

  const upcomingSubs = activeSubs
    .filter(s => s.billingDay != null)
    .map(s => ({ ...s, days: daysUntil(s.billingDay!) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)

  const monthResult = incomeMonth - expensesMonth
  const spentPct = incomeMonth > 0 ? Math.min(100, Math.round((expensesMonth / incomeMonth) * 100)) : null
  const dayFmt = new Intl.DateTimeFormat("es-CL", { day: "2-digit" })
  const monFmt = new Intl.DateTimeFormat("es-CL", { month: "short" })

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">

      {/* Greeting */}
      <div>
        <p className="text-[13px] text-[#86868b] font-medium">{greeting},</p>
        <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight leading-tight">{firstName}</h1>
      </div>

      {/* Balance hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d1d1f] via-[#232326] to-[#2c2c2e] dark:from-[#1c1c1e] dark:via-[#161618] dark:to-[#0b0b0c] dark:border dark:border-white/[0.08] text-white shadow-[0_20px_50px_rgba(0,0,0,0.16)]">
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-[#007aff]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-10 w-72 h-72 rounded-full bg-[#34c759]/10 blur-3xl" />
        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold text-white/55 uppercase tracking-[0.12em]">Saldo disponible</p>
              <PrivateAmount value={clp(checkingBalance)} className="block mt-2 text-[38px] lg:text-[46px] font-semibold tracking-tight tabular-nums leading-none" />
              <p className="mt-3 text-[12px] text-white/45">Cuentas corrientes y de ahorro</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:min-w-[340px]">
              <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] px-4 py-3">
                <p className="text-[10px] text-white/50 uppercase tracking-[0.08em] font-semibold">Deuda tarjetas</p>
                <PrivateAmount value={creditDebt > 0 ? `−${clp(creditDebt)}` : clp(0)} className="block mt-1 text-[16px] font-semibold tabular-nums text-[#ff453a]" />
              </div>
              <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] px-4 py-3">
                <p className="text-[10px] text-white/50 uppercase tracking-[0.08em] font-semibold">Balance neto</p>
                <PrivateAmount
                  value={netBalance === 0 ? clp(0) : netPositive ? clp(netBalance) : `−${clp(Math.abs(netBalance))}`}
                  className={`block mt-1 text-[16px] font-semibold tabular-nums ${netPositive ? "text-[#30d158]" : "text-[#ff453a]"}`}
                />
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-5 gap-1">
            <NewTransactionButton variant="income" accounts={accounts} categories={categories} defaultAccountId={userSettings?.defaultAccountId} budgetStatus={budgetStatus} />
            <NewTransactionButton variant="expense" accounts={accounts} categories={categories} defaultAccountId={userSettings?.defaultAccountId} budgetStatus={budgetStatus} />
            <NewTransferButton variant="tile" accounts={accounts} />
            <Link href="/dashboard/transactions" className={quickActionCls}>
              <QuickActionContent kind="statement" label="Cartola" />
            </Link>
            <Link href="/dashboard/budgets" className={quickActionCls}>
              <QuickActionContent kind="budget" label="Presupuestos" />
            </Link>
          </div>
        </div>
      </section>

      {!onboarding.completed && <OnboardingBanner steps={onboarding.steps} percent={onboarding.percent} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Products */}
          <section className={card}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.05]">
              <div>
                <h2 className={sectionTitle}>Mis productos</h2>
                <p className="text-[12px] text-[#86868b]">{accounts.length} {accounts.length === 1 ? "producto activo" : "productos activos"}</p>
              </div>
              <Link href="/dashboard/accounts" className={linkAction}>Administrar →</Link>
            </div>
            {productGroups.map(g => (
              <div key={g.title} className="pb-1">
                <p className={`${eyebrow} px-5 pt-4 pb-1`}>{g.title}</p>
                <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {g.items.map(a => {
                    const isCredit = a.type === "CREDIT_CARD"
                    const cur = a.currency ?? "CLP"
                    const used = Math.abs(Math.min(0, a.balance))
                    const limit = a.creditLimit ?? 0
                    const pct = isCredit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null
                    const barColor = pct == null ? "#86868b" : pct >= 80 ? "#ff3b30" : pct >= 50 ? "#ff9500" : "#34c759"
                    const mainValue = isCredit
                      ? (limit > 0 ? fmtCurrency(Math.max(0, limit - used), cur) : fmtCurrency(used, cur))
                      : fmtCurrency(a.balance, cur)
                    const mainLabel = isCredit ? (limit > 0 ? "Cupo disponible" : "Utilizado") : "Saldo"
                    return (
                      <Link key={a.id} href={`/dashboard/accounts/${a.id}`}
                        className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.03] transition-colors">
                        <ProductIcon type={a.type} color={a.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white truncate">{a.name}</p>
                          <p className="text-[12px] text-[#86868b] truncate">
                            {ACCOUNT_TYPE_LABEL[a.type]}{a.bank ? ` · ${a.bank}` : ""}{cur !== "CLP" ? ` · ${cur}` : ""}
                          </p>
                          {pct != null && (
                            <div className="mt-2 h-1 w-full max-w-[220px] rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] text-[#86868b] font-semibold uppercase tracking-wide">{mainLabel}</p>
                          <PrivateAmount value={mainValue}
                            className={`block text-[15px] font-semibold tabular-nums ${!isCredit && a.balance < 0 ? "text-[#ff3b30]" : "text-[#1d1d1f] dark:text-white"}`} />
                          {isCredit && limit > 0 && (
                            <PrivateAmount value={`Usado ${fmtCurrency(used, cur)}`} className="block text-[11px] text-[#ff3b30] tabular-nums" />
                          )}
                        </div>
                        <svg className="w-4 h-4 text-[#c7c7cc] dark:text-[#48484a] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* Recent movements */}
          <section className={card}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.05]">
              <div>
                <h2 className={sectionTitle}>Últimos movimientos</h2>
                <p className="text-[12px] text-[#86868b]">Todas tus cuentas</p>
              </div>
              <Link href="/dashboard/transactions" className={linkAction}>Ver cartola →</Link>
            </div>
            {recentTransactions.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-[#86868b]">Sin movimientos aún</p>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {recentTransactions.map(tx => {
                  const d = new Date(tx.date)
                  const isTransfer = tx.type === "TRANSFER"
                  const isIncome = tx.type === "INCOME"
                  return (
                    <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-10 text-center flex-shrink-0">
                        <p className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white leading-none tabular-nums">{dayFmt.format(d)}</p>
                        <p className="text-[10px] uppercase text-[#86868b] font-semibold mt-1 tracking-wide">{monFmt.format(d).replace(".", "")}</p>
                      </div>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] flex-shrink-0"
                        style={{ backgroundColor: tx.category?.color ? `${tx.category.color}1f` : isTransfer ? "#007aff1f" : "#86868b1f" }}>
                        {tx.category?.icon ?? (isIncome ? "↑" : isTransfer ? "⇄" : "↓")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white truncate">
                          {tx.description ?? tx.category?.name ?? (isTransfer ? "Transferencia" : "Sin descripción")}
                        </p>
                        <p className="text-[12px] text-[#86868b] truncate">
                          {tx.category?.name ?? (isTransfer ? "Transferencia" : isIncome ? "Abono" : "Cargo")} · {tx.account.name}
                        </p>
                      </div>
                      <PrivateAmount
                        value={`${isTransfer ? "" : isIncome ? "+" : "−"}${clp(Number(tx.amount))}`}
                        className={`text-[14px] font-semibold tabular-nums flex-shrink-0 ${
                          isIncome ? "text-[#34c759]" : isTransfer ? "text-[#007aff]" : "text-[#1d1d1f] dark:text-white"
                        }`}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Month summary */}
          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={sectionTitle}>Resumen del mes</h2>
              <span className="text-[12px] text-[#86868b] capitalize">{month}</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] text-[#6e6e73] dark:text-[#8e8e93]">
                  <span className="w-2 h-2 rounded-full bg-[#34c759]" />Ingresos
                </span>
                <PrivateAmount value={clp(incomeMonth)} className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] text-[#6e6e73] dark:text-[#8e8e93]">
                  <span className="w-2 h-2 rounded-full bg-[#ff3b30]" />Gastos
                </span>
                <PrivateAmount value={clp(expensesMonth)} className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
              </div>
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">Resultado</span>
                <PrivateAmount
                  value={`${monthResult >= 0 ? "+" : "−"}${clp(Math.abs(monthResult))}`}
                  className={`text-[16px] font-semibold tabular-nums ${monthResult >= 0 ? "text-[#34c759]" : "text-[#ff3b30]"}`}
                />
              </div>
            </div>
            {spentPct !== null && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-[#34c759]/15 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${spentPct}%`, backgroundColor: spentPct >= 100 ? "#ff3b30" : spentPct >= 80 ? "#ff9500" : "#007aff" }} />
                </div>
                <p className="mt-2 text-[11px] text-[#86868b]">
                  Has gastado el <span className="font-semibold text-[#1d1d1f] dark:text-white">{spentPct}%</span> de tus ingresos
                  {savingsRate !== null && savingsRate > 0 && <> · ahorro {savingsRate}%</>}
                </p>
              </div>
            )}
          </section>

          {/* Budgets */}
          <section className={card}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.05]">
              <h2 className={sectionTitle}>Presupuestos</h2>
              <Link href="/dashboard/budgets" className={linkAction}>{budgetProgress.length > 0 ? "Ver todos →" : "Crear →"}</Link>
            </div>
            {budgetProgress.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-[#86868b] text-center">Aún no fijas presupuestos este mes.</p>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {budgetProgress.slice(0, 4).map(b => {
                  const barColor = b.pct >= 100 ? "#ff3b30" : b.pct >= 80 ? "#ff9500" : "#34c759"
                  return (
                    <div key={b.categoryId} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] dark:text-white min-w-0">
                          <span>{b.icon ?? "📦"}</span><span className="truncate">{b.name}</span>
                        </span>
                        <span className="text-[12px] font-semibold tabular-nums" style={{ color: barColor }}>{b.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: barColor }} />
                      </div>
                      <PrivateAmount value={`${clp(b.spent)} de ${clp(b.budget)}`} className="block mt-1 text-[11px] text-[#86868b] tabular-nums" />
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Upcoming charges */}
          <section className={card}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.05]">
              <div>
                <h2 className={sectionTitle}>Próximos cobros</h2>
                {activeSubs.length > 0 && (
                  <p className="text-[12px] text-[#86868b]">
                    <PrivateAmount value={clp(totalSubsMonthly)} /> al mes · {activeSubs.length} {activeSubs.length === 1 ? "suscripción" : "suscripciones"}
                  </p>
                )}
              </div>
              <Link href="/dashboard/subscriptions" className={linkAction}>{activeSubs.length > 0 ? "Ver →" : "Agregar →"}</Link>
            </div>
            {upcomingSubs.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-[#86868b] text-center">Sin cobros programados.</p>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {upcomingSubs.map(s => {
                  const urgent = s.days <= 3
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[16px] flex-shrink-0 ${urgent ? "bg-[#ff9500]/[0.14]" : "bg-[#f5f5f7] dark:bg-white/[0.06]"}`}>
                        {s.icon ?? "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{s.name}</p>
                        <p className={`text-[11px] ${s.days === 0 ? "text-[#ff3b30] font-semibold" : urgent ? "text-[#ff9500] font-semibold" : "text-[#86868b]"}`}>
                          {s.days === 0 ? "Cobra hoy" : s.days === 1 ? "Cobra mañana" : `En ${s.days} días · día ${s.billingDay}`}
                        </p>
                      </div>
                      <PrivateAmount value={clp(s.amount)} className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
