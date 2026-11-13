"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

export default function ReconcileButton({ accountId, currentBalance }: {
  accountId: string
  currentBalance: number
}) {
  const [open, setOpen] = useState(false)
  const [realBalance, setRealBalance] = useState("")
  const [result, setResult] = useState<{ success?: boolean; delta?: number; error?: string } | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const real = realBalance !== "" ? parseFloat(realBalance) : null
  const delta = real !== null && !isNaN(real) ? real - currentBalance : null

  function close() { setOpen(false); setRealBalance(""); setResult(null) }

  function submit() {
    if (real === null || isNaN(real)) return
    startTransition(async () => {
      const r = await api.accounts.reconcile(accountId, real)
      setResult(r.ok ? { success: true, delta: r.data.delta } : { error: r.error })
      if (r.ok) {
        setTimeout(() => { close(); router.refresh() }, 1600)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Reconciliar saldo"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#007aff] hover:bg-[#007aff]/[0.08] transition-all flex-shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 anim-fade-in">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-black/[0.08] dark:border-white/[0.08] anim-pop-in">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white mb-1">Reconciliar saldo</h3>
            <p className="text-[12px] text-[#86868b] mb-5">
              Saldo registrado: <span className="font-semibold text-[#1d1d1f] dark:text-white">{fmt(currentBalance)}</span>
            </p>

            {result?.success ? (
              <div className="py-4 text-center">
                <p className="text-[36px] mb-2">{result.delta! > 0 ? "⬆️" : result.delta! < 0 ? "⬇️" : "✓"}</p>
                <p className="text-[14px] font-semibold text-[#34c759]">
                  {result.delta === 0 ? "Sin diferencia" : `Ajuste de ${fmt(Math.abs(result.delta!))} aplicado`}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">
                    Saldo real en banco (CLP)
                  </label>
                  <input
                    type="number" step="1" autoFocus
                    placeholder={currentBalance.toString()}
                    value={realBalance}
                    onChange={e => setRealBalance(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") close() }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white focus:outline-none focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#007aff]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.12)] transition-all duration-200 text-[14px]"
                  />
                </div>

                {delta !== null && delta !== 0 && (
                  <div className={`text-[12px] font-medium mb-3 px-3 py-2 rounded-xl ${delta > 0 ? "text-[#34c759] bg-[#34c759]/10" : "text-[#ff3b30] bg-[#ff3b30]/10"}`}>
                    Diferencia: {delta > 0 ? "+" : ""}{fmt(delta)} — se registrará un {delta > 0 ? "ingreso" : "gasto"} de ajuste
                  </div>
                )}
                {delta === 0 && realBalance !== "" && (
                  <p className="text-[12px] text-[#86868b] mb-3">El saldo ya está correcto, no hay ajuste necesario.</p>
                )}
                {result?.error && (
                  <p className="text-[12px] text-[#ff3b30] mb-3">{result.error}</p>
                )}

                <div className="flex gap-2.5">
                  <button onClick={close}
                    className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80">
                    Cancelar
                  </button>
                  <button onClick={submit} disabled={real === null || isNaN(real) || delta === 0}
                    className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold hover:opacity-90 disabled:opacity-40">
                    Aplicar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
