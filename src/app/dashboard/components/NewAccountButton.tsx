"use client"
import { useRef, useActionState } from "react"
import { createAccount } from "@/app/actions/finance"

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Cuenta corriente" },
  { value: "SAVINGS", label: "Cuenta de ahorro" },
  { value: "CREDIT_CARD", label: "Tarjeta de crédito" },
  { value: "CASH", label: "Efectivo" },
  { value: "INVESTMENT", label: "Inversiones" },
]

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f97316", "#eab308",
]

export default function NewAccountButton() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    const result = await createAccount(formData)
    if (!result?.error) dialogRef.current?.close()
    return result
  }, undefined)

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-semibold rounded-lg transition"
      >
        + Nueva cuenta
      </button>

      <dialog
        ref={dialogRef}
        className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm shadow-2xl backdrop:bg-black/60 open:flex open:flex-col"
        onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}
      >
        <h3 className="text-white font-semibold text-lg mb-5">Nueva cuenta</h3>

        {state?.error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{state.error}</p>
        )}

        <form action={action} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Nombre</label>
            <input
              name="name"
              required
              placeholder="Ej: Banco Santander"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo</label>
            <select
              name="type"
              required
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Saldo inicial (CLP)</label>
            <input
              name="balance"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c, i) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="color" value={c} defaultChecked={i === 0} className="sr-only peer" />
                  <span
                    className="block w-7 h-7 rounded-full ring-2 ring-transparent peer-checked:ring-white peer-checked:ring-offset-2 peer-checked:ring-offset-gray-900 transition"
                    style={{ backgroundColor: c }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold text-sm transition"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
