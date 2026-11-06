"use client"
import { useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"

type Cat = { id: string; name: string; color: string; icon: string | null }

const fmt = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

export default function BudgetsClient({ categories, spent, budgetMap, month, year }: {
  categories: Cat[]
  spent: Record<string, number>
  budgetMap: Record<string, number>
  month: number
  year: number
}) {
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [inputVal, setInputVal] = useState("")
  const [copyError, setCopyError] = useState("")
  const router = useRouter()

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date(year, month - 1))

  const totalBudget = Object.values(budgetMap).reduce((s, v) => s + v, 0)
  const totalSpent = Object.values(spent).reduce((s, v) => s + v, 0)

  function navigate(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    router.push(`/dashboard/budgets?month=${d.getMonth() + 1}&year=${d.getFullYear()}`)
  }

  function save(catId: string) {
    const amount = parseFloat(inputVal.replace(/\./g, "").replace(",", ".")) || 0
    startTransition(async () => {
      await api.budgets.set({ categoryId: catId, amount, month, year })
      router.refresh()
    })
    setEditing(null)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Presupuestos</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5 capitalize">{monthLabel}</p>
        </div>
        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.08] border border-transparent hover:border-black/[0.09] dark:hover:border-white/[0.09] transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          {!isCurrentMonth && (
            <button onClick={() => router.push("/dashboard/budgets")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/10 transition-colors">
              Hoy
            </button>
          )}
          <button onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.08] border border-transparent hover:border-black/[0.09] dark:hover:border-white/[0.09] transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Summary */}
      {totalBudget > 0 && (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Gastado este mes</p>
              <p className="text-[28px] font-semibold text-[#1d1d1f] dark:text-white mt-1">{fmt(totalSpent)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Presupuesto total</p>
              <p className="text-[28px] font-semibold text-[#1d1d1f] dark:text-white mt-1">{fmt(totalBudget)}</p>
            </div>
          </div>
          <div className="h-2 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden">
            {(() => {
              const pct = Math.min(100, Math.round((totalSpent / totalBudget) * 100))
              const color = pct >= 90 ? "#ff3b30" : pct >= 70 ? "#ff9500" : "#34c759"
              return <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            })()}
          </div>
          <p className="text-[11px] text-[#86868b] mt-2">
            {fmt(Math.max(0, totalBudget - totalSpent))} disponible · {Math.min(100, Math.round((totalSpent / totalBudget) * 100))}% usado
          </p>
        </div>
      )}

      {/* Copy from previous month — shown when this month has no budgets yet */}
      {totalBudget === 0 && (
        <div className="mb-5 p-4 bg-[#f5f5f7] dark:bg-white/[0.05] rounded-2xl border border-black/[0.07] dark:border-white/[0.07] flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">Sin presupuestos este mes</p>
            <p className="text-[11px] text-[#86868b] mt-0.5">Puedes copiar los montos del mes anterior o fijarlos manualmente.</p>
            {copyError && <p className="text-[11px] text-[#ff3b30] mt-1">{copyError}</p>}
          </div>
          <button
            onClick={() => startTransition(async () => {
              const r = await api.budgets.copyPrevious(month, year)
              if (r.error) { setCopyError(r.error); return }
              setCopyError("")
              router.refresh()
            })}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[12px] font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
            Copiar mes anterior
          </button>
        </div>
      )}

      <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">Por categoría</p>
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none divide-y divide-black/[0.06] dark:divide-white/[0.05]">
        {categories.map(cat => {
          const budget = budgetMap[cat.id] ?? 0
          const catSpent = spent[cat.id] ?? 0
          const pct = budget > 0 ? Math.min(100, Math.round((catSpent / budget) * 100)) : 0
          const barColor = pct >= 90 ? "#ff3b30" : pct >= 70 ? "#ff9500" : "#34c759"
          const isEditing = editing === cat.id

          return (
            <div key={cat.id} className="px-4 py-3.5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0" style={{ backgroundColor: `${cat.color}20` }}>
                  {cat.icon ?? <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">{cat.name}</p>
                  <p className="text-[11px] text-[#86868b]">{fmt(catSpent)} gastado{budget > 0 ? ` de ${fmt(budget)}` : ""}</p>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                      placeholder="0" autoFocus
                      className="w-28 px-2.5 py-1.5 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-[13px] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                      onKeyDown={e => { if (e.key === "Enter") save(cat.id); if (e.key === "Escape") setEditing(null) }} />
                    <button onClick={() => save(cat.id)} className="text-[#007aff] text-[13px] font-semibold">OK</button>
                    <button onClick={() => setEditing(null)} className="text-[#86868b] text-[13px]">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditing(cat.id); setInputVal(budget > 0 ? String(budget) : "") }}
                    className="text-[12px] text-[#007aff] font-medium hover:opacity-70 transition-opacity">
                    {budget > 0 ? "Editar" : "Fijar"}
                  </button>
                )}
              </div>
              {budget > 0 && (
                <div className="h-1.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden ml-11">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
