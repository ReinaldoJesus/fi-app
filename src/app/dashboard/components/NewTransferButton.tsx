"use client"
import { useRef, useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"
import { QuickActionContent, quickActionCls } from "@/components/QuickAction"

type Account = { id: string; name: string; type: string; balance: number }

const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px]"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"

const fmt = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Corriente", SAVINGS: "Ahorro", CREDIT_CARD: "Crédito", CASH: "Efectivo", INVESTMENT: "Inversión",
}

export default function NewTransferButton({ accounts, variant = "button" }: { accounts: Account[]; variant?: "button" | "tile" }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const today = new Date().toLocaleDateString("en-CA")
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "")
  const [toId, setToId] = useState(accounts.length > 1 ? accounts[1].id : accounts[0]?.id ?? "")
  const [amountStr, setAmountStr] = useState("")

  const fromAccount = accounts.find(a => a.id === fromId)
  const sameAccount = fromId && toId && fromId === toId
  const amount = parseFloat(amountStr) || 0
  const insufficientFunds = fromAccount && amount > 0 && amount > Number(fromAccount.balance)

  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    const r = await api.transfers.create(formData)
    if (!r.error) {
      dialogRef.current?.close()
      router.refresh()
      return undefined
    }
    return r
  }, undefined)

  return (
    <>
      {variant === "tile" ? (
        <button type="button" className={quickActionCls} onClick={() => dialogRef.current?.showModal()}>
          <QuickActionContent kind="transfer" label="Transferir" />
        </button>
      ) : (
        <button onClick={() => dialogRef.current?.showModal()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.09] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Transferir
        </button>
      )}

      <dialog ref={dialogRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close() }}>

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Transferir entre cuentas</h3>
          <button type="button" onClick={() => dialogRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {(state?.error || sameAccount) && (
          <p className="mb-4 text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">
            {state?.error ?? "Las cuentas de origen y destino deben ser diferentes."}
          </p>
        )}

        <form action={action} className="space-y-4">
          <div>
            <label className={labelCls}>Desde</label>
            <select name="fromAccountId" required value={fromId} onChange={e => setFromId(e.target.value)} className={inputCls}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({ACCOUNT_TYPE_LABELS[a.type] ?? a.type}) · {fmt(Number(a.balance))}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-[#f5f5f7] dark:bg-white/[0.08] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          <div>
            <label className={labelCls}>Hacia</label>
            <select name="toAccountId" required value={toId} onChange={e => setToId(e.target.value)} className={inputCls}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({ACCOUNT_TYPE_LABELS[a.type] ?? a.type}) · {fmt(Number(a.balance))}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Monto (CLP)</label>
            <input name="amount" type="number" min="1" step="1" required placeholder="0"
              value={amountStr} onChange={e => setAmountStr(e.target.value)} className={inputCls} />
            {insufficientFunds && (
              <p className="text-[11px] text-[#ff9500] mt-1.5">
                Saldo insuficiente · disponible {fmt(Number(fromAccount!.balance))}
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Descripción (opcional)</label>
            <input name="description" type="text" placeholder="Ej: Pago tarjeta, ahorro mensual..." className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Fecha</label>
            <input name="date" type="date" required defaultValue={today} className={inputCls} />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={() => dialogRef.current?.close()}
              className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80 transition-opacity">
              Cancelar
            </button>
            <button type="submit" disabled={pending || !!sameAccount}
              className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold text-[13px] transition-all">
              {pending ? "Transfiriendo..." : "Transferir"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
