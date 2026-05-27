"use client"
import { useRef, useActionState, useState } from "react"
import { createTransaction } from "@/app/actions/finance"

type Account = { id: string; name: string }
type Category = { id: string; name: string; type: string; icon: string | null }

export default function NewTransactionButton({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE")
  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    const result = await createTransaction(formData)
    if (!result?.error) dialogRef.current?.close()
    return result
  }, undefined)

  const filteredCategories = categories.filter((c) => c.type === type)
  const today = new Date().toISOString().split("T")[0]

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded-lg transition"
      >
        + Agregar
      </button>

      <dialog
        ref={dialogRef}
        className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm shadow-2xl backdrop:bg-black/60 open:flex open:flex-col"
        onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}
      >
        <h3 className="text-white font-semibold text-lg mb-5">Nueva transacción</h3>

        {state?.error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{state.error}</p>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Primero crea una cuenta para registrar transacciones.</p>
        ) : (
          <form action={action} className="space-y-4">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-2">
              {(["EXPENSE", "INCOME"] as const).map((t) => (
                <label key={t} className="cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="sr-only peer"
                  />
                  <span className={`block text-center py-2 rounded-xl border text-sm font-semibold transition peer-checked:border-transparent
                    ${t === "EXPENSE"
                      ? "border-gray-700 text-gray-400 peer-checked:bg-red-500/20 peer-checked:text-red-400"
                      : "border-gray-700 text-gray-400 peer-checked:bg-emerald-500/20 peer-checked:text-emerald-400"
                    }`}>
                    {t === "EXPENSE" ? "📉 Gasto" : "📈 Ingreso"}
                  </span>
                </label>
              ))}
            </div>

            {/* Monto */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Monto (CLP)</label>
              <input
                name="amount"
                type="number"
                min="1"
                step="1"
                required
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Descripción</label>
              <input
                name="description"
                placeholder="Ej: Supermercado Lider"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Fecha</label>
              <input
                name="date"
                type="date"
                defaultValue={today}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            {/* Cuenta */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Cuenta</label>
              <select
                name="accountId"
                required
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Categoría */}
            {filteredCategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Categoría</label>
                <select
                  name="categoryId"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="">Sin categoría</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
            )}

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
        )}
      </dialog>
    </>
  )
}

