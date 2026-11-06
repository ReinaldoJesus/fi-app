"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"

type MonthData = { label: string; income: number; expense: number; savings: number }
type CatData = { name: string; color: string; icon: string | null; amount: number }

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-lg text-[12px]">
      <p className="font-semibold text-[#1d1d1f] dark:text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.dataKey === "income" ? "#34c759" : "#ff3b30" }}>
          {p.dataKey === "income" ? "Ingresos" : "Gastos"}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-lg text-[12px]">
      <p className="font-semibold text-[#1d1d1f] dark:text-white">{payload[0].name}</p>
      <p className="text-[#86868b]">{fmt(payload[0].value)}</p>
    </div>
  )
}

export default function AnalyticsClient({
  months, byCategory, budgetMap,
  avgMonthlyExpense, projectedExpense, today, daysInMonth, period, netWorth,
}: {
  months: MonthData[]
  byCategory: CatData[]
  budgetMap: Record<string, number>
  avgMonthlyExpense: number
  projectedExpense: number
  today: number
  daysInMonth: number
  period: number
  netWorth: number
}) {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  useEffect(() => setMounted(true), [])

  const totalExpense = byCategory.reduce((s, c) => s + c.amount, 0)
  const currentMonth = months[months.length - 1]
  const prevMonth = months[months.length - 2]

  const savingsRate = currentMonth.income > 0
    ? Math.round(((currentMonth.income - currentMonth.expense) / currentMonth.income) * 100)
    : 0

  const expenseChange = prevMonth?.expense > 0
    ? Math.round(((currentMonth.expense - prevMonth.expense) / prevMonth.expense) * 100)
    : 0

  const totalBudget = Object.values(budgetMap).reduce((s, v) => s + v, 0)
  const projVsBudget = totalBudget > 0 ? Math.round((projectedExpense / totalBudget) * 100) : null

  return (
    <>
      {/* Print styles */}
      <style>{`@media print {
        nav, aside, button, .no-print { display: none !important; }
        body { background: white !important; }
        .print-break { page-break-before: always; }
      }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <div>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Análisis</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5">Últimos {period} meses</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex gap-1 p-1 bg-white dark:bg-[#1c1c1e] border border-black/[0.09] dark:border-white/[0.07] rounded-xl shadow-sm">
            {[3, 6, 12].map(p => (
              <button key={p} onClick={() => router.push(`/dashboard/analytics?period=${p}`)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  period === p
                    ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
                    : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                }`}>
                {p}M
              </button>
            ))}
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.09] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Ingresos este mes",
            value: fmt(currentMonth.income),
            sub: `vs ${fmt(prevMonth?.income ?? 0)} anterior`,
            color: "text-[#34c759]",
          },
          {
            label: "Gastos este mes",
            value: fmt(currentMonth.expense),
            sub: expenseChange !== 0
              ? `${expenseChange > 0 ? "+" : ""}${expenseChange}% vs anterior`
              : "sin cambio",
            color: expenseChange > 5 ? "text-[#ff3b30]" : "text-[#1d1d1f] dark:text-white",
          },
          {
            label: "Tasa de ahorro",
            value: `${savingsRate}%`,
            sub: savingsRate >= 20 ? "Excelente" : savingsRate >= 10 ? "Bueno" : "Mejorable",
            color: savingsRate >= 20 ? "text-[#34c759]" : savingsRate >= 10 ? "text-[#ff9500]" : "text-[#ff3b30]",
          },
          {
            label: "Patrimonio neto",
            value: fmt(netWorth),
            sub: netWorth >= 0 ? "Activos > Deudas" : "Deudas > Activos",
            color: netWorth >= 0 ? "text-[#007aff]" : "text-[#ff3b30]",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-4">
            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-[16px] font-semibold tabular-nums ${color}`}>{value}</p>
            <p className="text-[10px] text-[#86868b] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Proyección del mes */}
      {projectedExpense > 0 && (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-6">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">Proyección · mes actual</p>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[11px] text-[#86868b]">Día {today} de {daysInMonth}</p>
              <p className="text-[24px] font-semibold text-[#1d1d1f] dark:text-white">{fmt(projectedExpense)}</p>
              <p className="text-[11px] text-[#86868b] mt-0.5">proyectado al fin de mes</p>
            </div>
            {totalBudget > 0 && projVsBudget !== null && (
              <div className="flex-1">
                <div className="h-2 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, projVsBudget)}%`,
                      backgroundColor: projVsBudget >= 100 ? "#ff3b30" : projVsBudget >= 80 ? "#ff9500" : "#34c759",
                    }} />
                </div>
                <p className={`text-[11px] mt-1 font-medium ${projVsBudget >= 100 ? "text-[#ff3b30]" : projVsBudget >= 80 ? "text-[#ff9500]" : "text-[#34c759]"}`}>
                  {projVsBudget}% del presupuesto mensual ({fmt(totalBudget)})
                </p>
              </div>
            )}
            {avgMonthlyExpense > 0 && (
              <div className="text-right">
                <p className="text-[11px] text-[#86868b]">Promedio 3 meses</p>
                <p className="text-[16px] font-semibold text-[#86868b]">{fmt(avgMonthlyExpense)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-6">
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-4">Ingresos vs Gastos</p>
        {mounted ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={months} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#86868b" }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar dataKey="income" fill="#34c759" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#ff3b30" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] bg-[#f5f5f7] dark:bg-white/[0.04] rounded-xl animate-pulse" />
        )}
        <div className="flex gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[#86868b]"><span className="w-2.5 h-2.5 rounded-full bg-[#34c759]" />Ingresos</span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#86868b]"><span className="w-2.5 h-2.5 rounded-full bg-[#ff3b30]" />Gastos</span>
        </div>
      </div>

      {/* Monthly savings chart */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-6">
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-4">Ahorro neto mensual</p>
        {mounted ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={months} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#86868b" }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const val = payload[0].value as number
                  return (
                    <div className="bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-lg text-[12px]">
                      <p className="font-semibold text-[#1d1d1f] dark:text-white mb-1">{label}</p>
                      <p style={{ color: val >= 0 ? "#34c759" : "#ff3b30" }}>
                        {val >= 0 ? "Ahorro" : "Déficit"}: {fmt(Math.abs(val))}
                      </p>
                    </div>
                  )
                }}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
              />
              <Bar dataKey="savings" radius={[4, 4, 0, 0]}>
                {months.map((m, i) => (
                  <Cell key={i} fill={m.savings >= 0 ? "#34c759" : "#ff3b30"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[160px] bg-[#f5f5f7] dark:bg-white/[0.04] rounded-xl animate-pulse" />
        )}
        <div className="flex gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[#86868b]"><span className="w-2.5 h-2.5 rounded-full bg-[#34c759]" />Ahorro</span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#86868b]"><span className="w-2.5 h-2.5 rounded-full bg-[#ff3b30]" />Déficit</span>
        </div>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-6">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-4">Gastos por categoría · mes actual</p>
          <div className="flex gap-6 items-center">
            {mounted ? (
              <div className="flex-shrink-0">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={byCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%"
                      innerRadius={42} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                      {byCategory.map((cat, i) => <Cell key={i} fill={cat.color} />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-[140px] h-[140px] rounded-full bg-[#f5f5f7] dark:bg-white/[0.04] animate-pulse flex-shrink-0" />
            )}
            <div className="flex-1 space-y-2 min-w-0">
              {byCategory.slice(0, 6).map(cat => {
                const pct = totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0
                return (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className="text-[13px] flex-shrink-0">{cat.icon ?? "•"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#1d1d1f] dark:text-white truncate">{cat.name}</span>
                        <span className="text-[11px] text-[#86868b] ml-2 flex-shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full mt-0.5">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                    <span className="text-[11px] text-[#86868b] flex-shrink-0 w-20 text-right tabular-nums">{fmt(cat.amount)}</span>
                  </div>
                )
              })}
              {byCategory.length > 6 && <p className="text-[11px] text-[#86868b]">+{byCategory.length - 6} más</p>}
            </div>
          </div>
        </div>
      )}

      {/* Top categories detail */}
      {byCategory.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">Detalle por categoría</p>
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none divide-y divide-black/[0.06] dark:divide-white/[0.05]">
            {byCategory.map(cat => {
              const pct = totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0
              return (
                <div key={cat.name} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[14px] flex-shrink-0" style={{ backgroundColor: `${cat.color}20` }}>
                    {cat.icon ?? <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">{cat.name}</p>
                      <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums">{fmt(cat.amount)}</p>
                    </div>
                    <div className="h-1.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                    <p className="text-[10px] text-[#86868b] mt-0.5">{pct}% del total de gastos</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {byCategory.length === 0 && (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none px-5 py-12 text-center">
          <p className="text-[#86868b] text-sm">Sin gastos este mes</p>
        </div>
      )}
    </>
  )
}
