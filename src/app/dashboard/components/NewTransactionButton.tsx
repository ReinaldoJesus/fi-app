"use client"
import { useRef, useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"
import { QuickActionContent, quickActionCls } from "@/components/QuickAction"

type Account = { id: string; name: string; type?: string }
type Category = { id: string; name: string; type: string; icon: string | null }

const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px]"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"
const fmt = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

export default function NewTransactionButton({
  accounts, categories, defaultAccountId, budgetStatus, variant = "button",
}: {
  accounts: Account[]
  categories: Category[]
  defaultAccountId?: string | null
  budgetStatus?: Record<string, { budget: number; spent: number }>
  /** "button" = default dark button; "income"/"expense" = quick-action tile that opens preset to that type */
  variant?: "button" | "income" | "expense"
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const initialType = variant === "income" ? "INCOME" : "EXPENSE"
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initialType)
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const today = new Date().toLocaleDateString("en-CA")

  const budgetInfo = type === "EXPENSE" && selectedCategoryId && budgetStatus?.[selectedCategoryId]
    ? budgetStatus[selectedCategoryId]
    : null

  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    const result = await api.transactions.create(formData)
    if (!result.error) {
      dialogRef.current?.close()
      router.refresh()
    }
    return result
  }, undefined)

  return (
    <>
      {variant === "button" ? (
        <button onClick={() => dialogRef.current?.showModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d1d1f] dark:bg-white hover:opacity-90 text-white dark:text-[#1d1d1f] text-[13px] font-semibold rounded-xl transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva
        </button>
      ) : (
        <button type="button" className={quickActionCls}
          onClick={() => { setType(initialType); setSelectedCategoryId(""); dialogRef.current?.showModal() }}>
          <QuickActionContent kind={variant} label={variant === "income" ? "Ingreso" : "Gasto"} />
        </button>
      )}

      <dialog ref={dialogRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Nueva transacción</h3>
          <button type="button" onClick={() => dialogRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {state?.error && <p className="mb-4 text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">{state.error}</p>}

        {accounts.length === 0 ? (
          <p className="text-sm text-[#86868b] text-center py-6">Primero crea una cuenta en la sección Cuentas.</p>
        ) : (
          <form action={action} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl">
              {(["EXPENSE", "INCOME"] as const).map((t) => (
                <label key={t} className="cursor-pointer">
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                  <span className={`block text-center py-2 rounded-lg text-[13px] font-semibold transition-all ${
                    type === t ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b]"
                  }`}>{t === "EXPENSE" ? "Gasto" : "Ingreso"}</span>
                </label>
              ))}
            </div>

            <div><label className={labelCls}>Monto (CLP)</label>
              <input name="amount" type="number" min="1" step="1" required placeholder="0" className={inputCls} /></div>

            <div><label className={labelCls}>Descripción</label>
              <input name="description" placeholder="Ej: Supermercado" className={inputCls} /></div>

            <div><label className={labelCls}>Notas (opcional)</label>
              <textarea name="notes" placeholder="Detalles adicionales..." rows={2}
                className={inputCls + " resize-none"} /></div>

            <div><label className={labelCls}>Fecha</label>
              <input name="date" type="date" defaultValue={today} required className={inputCls} /></div>

            <div><label className={labelCls}>Cuenta</label>
              <select name="accountId" required defaultValue={defaultAccountId ?? undefined} className={inputCls}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>

            {categories.filter((c) => c.type === type).length > 0 && (
              <div>
                <label className={labelCls}>Categoría</label>
                <select name="categoryId" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className={inputCls}>
                  <option value="">Sin categoría</option>
                  {categories.filter((c) => c.type === type).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                {budgetInfo && (() => {
                  const remaining = budgetInfo.budget - budgetInfo.spent
                  const pct = Math.round((budgetInfo.spent / budgetInfo.budget) * 100)
                  const over = remaining < 0
                  const color = over ? "#ff3b30" : pct >= 80 ? "#ff9500" : "#34c759"
                  return (
                    <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: `${color}15`, color }}>
                      {over
                        ? <span>⚠️ Superado por {fmt(Math.abs(remaining))} · {pct}% usado</span>
                        : <span>Quedan {fmt(remaining)} de {fmt(budgetInfo.budget)} · {pct}% usado</span>
                      }
                    </div>
                  )
                })()}
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button type="button" onClick={() => dialogRef.current?.close()}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80 transition-opacity">
                Cancelar
              </button>
              <button type="submit" disabled={pending}
                className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold text-[13px] transition-all">
                {pending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
