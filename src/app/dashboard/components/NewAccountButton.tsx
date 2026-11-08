"use client"
import { useRef, useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"
import { CURRENCIES } from "@/lib/fmt"
import { BANKS as BANK_PRESETS, accountName } from "@/lib/suggestions"

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Cuenta corriente" }, { value: "SAVINGS", label: "Cuenta de ahorro" },
  { value: "CREDIT_CARD", label: "Tarjeta de crédito" }, { value: "CASH", label: "Efectivo" },
  { value: "INVESTMENT", label: "Inversiones" },
]
const COLORS = ["#34c759", "#007aff", "#bf5af2", "#ff3b30", "#e63946", "#ff9500"]
const BANKS = BANK_PRESETS.map(b => b.name)

const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px]"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"

export default function NewAccountButton() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [accountType, setAccountType] = useState("CHECKING")
  const [currency, setCurrency] = useState("CLP")
  const [bankInput, setBankInput] = useState("")
  const [showSugg, setShowSugg] = useState(false)
  const [name, setName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)
  const [color, setColor] = useState(COLORS[0])
  // Smart default: "Cuenta corriente Santander" until the person types their own name.
  const suggestedName = accountName(accountType, bankInput.trim() || null)
  const shownName = nameTouched ? name : suggestedName
  function pickBank(b: string) {
    setBankInput(b)
    setShowSugg(false)
    const preset = BANK_PRESETS.find(p => p.name === b)
    if (preset && COLORS.includes(preset.color)) setColor(preset.color)
  }

  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    const result = await api.accounts.create(formData)
    if (!result.error) {
      dialogRef.current?.close()
      setAccountType("CHECKING")
      setCurrency("CLP")
      setBankInput("")
      setName("")
      setNameTouched(false)
      router.refresh()
    }
    return result
  }, undefined)

  const suggestions = BANKS.filter((b) => b.toLowerCase().includes(bankInput.toLowerCase()) && bankInput.length > 0)

  return (
    <>
      <button onClick={() => dialogRef.current?.showModal()}
        className="flex items-center gap-1.5 px-4 py-2 bg-[#1d1d1f] dark:bg-white hover:opacity-90 text-white dark:text-[#1d1d1f] text-[13px] font-semibold rounded-xl transition-all">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Nueva cuenta
      </button>

      <dialog ref={dialogRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Nueva cuenta</h3>
          <button type="button" onClick={() => dialogRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {state?.error && <p className="mb-4 text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">{state.error}</p>}

        <form action={action} className="space-y-4">
          <div className="relative">
            <label className={labelCls}>Banco</label>
            <input name="bank" value={bankInput}
              onChange={(e) => { setBankInput(e.target.value); setShowSugg(true) }}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              onFocus={() => setShowSugg(true)}
              placeholder="Ej: Santander, BCI..." className={inputCls} />
            {!bankInput && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BANK_PRESETS.slice(0, 6).map(b => (
                  <button key={b.name} type="button" onClick={() => pickBank(b.name)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white hover:bg-[#e8e8ed] dark:hover:bg-white/[0.12] transition-colors">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />{b.name}
                  </button>
                ))}
              </div>
            )}
            {showSugg && suggestions.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.08] rounded-xl overflow-hidden shadow-lg">
                {suggestions.map((b) => (
                  <li key={b} className="px-3.5 py-2.5 text-[13px] text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.06] cursor-pointer"
                    onMouseDown={() => pickBank(b)}>{b}</li>
                ))}
              </ul>
            )}
          </div>

          <div><label className={labelCls}>Nombre</label>
            <input name="name" required placeholder="Ej: Cuenta Corriente" value={shownName}
              onChange={e => { setNameTouched(true); setName(e.target.value) }} className={inputCls} /></div>

          <div><label className={labelCls}>Tipo</label>
            <select name="type" value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputCls}>
              {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>

          <div><label className={labelCls}>Moneda</label>
            <select name="currency" value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>

          {accountType === "CREDIT_CARD" ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Utilizado ({currency})</label>
                <input name="usedAmount" type="number" min="0" step="any" defaultValue="0" className={`${inputCls} tabular-nums`} /></div>
              <div><label className={labelCls}>Límite ({currency})</label>
                <input name="creditLimit" type="number" min="0" step="any" defaultValue="0" className={`${inputCls} tabular-nums`} /></div>
            </div>
          ) : (
            <div><label className={labelCls}>Saldo actual ({currency})</label>
              <input name="balance" type="number" step="any" defaultValue="0" className={`${inputCls} tabular-nums`} /></div>
          )}

          <div>
            <label className={labelCls}>Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only peer" />
                  <span className="block w-7 h-7 rounded-full ring-2 ring-transparent peer-checked:ring-[#1d1d1f] dark:peer-checked:ring-white peer-checked:ring-offset-2 peer-checked:ring-offset-white dark:peer-checked:ring-offset-[#1c1c1e] transition-all"
                    style={{ backgroundColor: c }} />
                </label>
              ))}
            </div>
          </div>

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
      </dialog>
    </>
  )
}
