"use client"
import { useRef, useActionState, useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"
import ConfirmDialog from "@/components/ConfirmDialog"

type Cat = { id: string; name: string; type: string; icon: string | null; color: string; isDefault: boolean; _count?: { transactions: number } }

const COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#10b981","#14b8a6","#06b6d4","#3b82f6","#6366f1","#8b5cf6","#a855f7","#ec4899","#f43f5e","#6b7280"]
const QUICK_ICONS = ["🍔","🚗","🏠","💊","🎮","👕","📚","✈️","☕","🍕","💪","🎵","🛒","💡","📱","🏥","🎬","🐾","🍷","💅","🎁","🔧","💼","📈","💰","💻"]

const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px]"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"
const cardCls = "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"

function CategoryForm({ initial, action, pending, error, onCancel, submitLabel }: {
  initial?: Cat; action: (fd: FormData) => void; pending: boolean
  error?: string; onCancel: () => void; submitLabel: string
}) {
  const [icon, setIcon] = useState(initial?.icon ?? "")
  const [color, setColor] = useState(initial?.color ?? "#6366f1")

  return (
    <form action={action} className="space-y-4">
      {error && <p className="text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">{error}</p>}

      <div>
        <label className={labelCls}>Nombre</label>
        <input name="name" type="text" required placeholder="Ej: Supermercado, Netflix..." defaultValue={initial?.name ?? ""} className={inputCls} />
      </div>

      {!initial && (
        <div>
          <label className={labelCls}>Tipo</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl">
            {(["EXPENSE", "INCOME"] as const).map(t => (
              <label key={t} className="cursor-pointer">
                <input type="radio" name="type" value={t} defaultChecked={t === "EXPENSE"} className="sr-only" />
                <span className="block text-center py-2 rounded-lg text-[13px] font-semibold text-[#86868b] has-[input:checked]:bg-white has-[input:checked]:dark:bg-white/[0.12] has-[input:checked]:text-[#1d1d1f] has-[input:checked]:dark:text-white transition-all">
                  {t === "EXPENSE" ? "Gasto" : "Ingreso"}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Ícono</label>
        <div className="flex gap-2">
          <input name="icon" type="text" placeholder="🍔" maxLength={4} value={icon} onChange={e => setIcon(e.target.value)}
            className="w-16 px-2 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/10 text-[18px] text-center" />
          <div className="flex-1 grid grid-cols-8 gap-1">
            {QUICK_ICONS.slice(0, 16).map(e => (
              <button key={e} type="button" onClick={() => setIcon(e)}
                className={`h-9 rounded-lg text-[15px] transition-colors ${icon === e ? "bg-[#1d1d1f] dark:bg-white" : "bg-[#f5f5f7] dark:bg-white/[0.06] hover:bg-[#e8e8ed] dark:hover:bg-white/[0.12]"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Color</label>
        <input name="color" type="hidden" value={color} />
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-black/30 dark:ring-white/30 scale-110" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80 transition-opacity">Cancelar</button>
        <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold text-[13px] transition-all">
          {pending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function CategoriesClient({ initialCats }: { initialCats: Cat[] }) {
  const addRef = useRef<HTMLDialogElement>(null)
  const editRef = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState<Cat | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Cat | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const [addState, addAction, addPending] = useActionState(async (_: unknown, fd: FormData) => {
    const r = await api.categories.create(fd)
    if (!r.error) { addRef.current?.close(); router.refresh(); return undefined }
    return r
  }, undefined)

  const [editState, editAction, editPending] = useActionState(async (_: unknown, fd: FormData) => {
    if (!editing) return undefined
    const r = await api.categories.update(editing.id, fd)
    if (!r.error) { editRef.current?.close(); router.refresh(); return undefined }
    return r
  }, undefined)

  const income = initialCats.filter(c => c.type === "INCOME")
  const expense = initialCats.filter(c => c.type === "EXPENSE")

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Categorías</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5">Organiza tus ingresos y gastos</p>
        </div>
        <button onClick={() => addRef.current?.showModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d1d1f] dark:bg-white hover:opacity-90 text-white dark:text-[#1d1d1f] text-[13px] font-semibold rounded-xl transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nueva
        </button>
      </div>

      {[{ label: "Gastos", cats: expense }, { label: "Ingresos", cats: income }].map(({ label, cats }) => (
        <div key={label} className="mb-6">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">{label}</p>
          {cats.length === 0 ? (
            <div className={`${cardCls} px-5 py-6 text-center`}>
              <p className="text-[13px] text-[#86868b]">Sin categorías de {label.toLowerCase()}</p>
            </div>
          ) : (
            <div className={`${cardCls} divide-y divide-black/[0.06] dark:divide-white/[0.05]`}>
              {cats.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[16px] flex-shrink-0" style={{ backgroundColor: `${cat.color}20` }}>
                    {cat.icon || <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white">{cat.name}</p>
                    {cat._count && <p className="text-[11px] text-[#86868b] mt-0.5">{cat._count.transactions} transacciones</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(cat); editRef.current?.showModal() }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    {!cat.isDefault && (
                      <button onClick={() => setConfirmDelete(cat)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add dialog */}
      <dialog ref={addRef} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto" onClick={e => { if (e.target === e.currentTarget) addRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Nueva categoría</h3>
          <button type="button" onClick={() => addRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <CategoryForm action={addAction} pending={addPending} error={addState?.error} onCancel={() => addRef.current?.close()} submitLabel="Crear" />
      </dialog>

      {/* Edit dialog */}
      <dialog ref={editRef} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto" onClick={e => { if (e.target === e.currentTarget) editRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Editar categoría</h3>
          <button type="button" onClick={() => editRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {editing && <CategoryForm key={editing.id} initial={editing} action={editAction} pending={editPending} error={editState?.error} onCancel={() => editRef.current?.close()} submitLabel="Guardar" />}
      </dialog>

      {confirmDelete && (
        <ConfirmDialog
          title={`Eliminar "${confirmDelete.name}"`}
          message={confirmDelete._count && confirmDelete._count.transactions > 0
            ? `Esta categoría tiene ${confirmDelete._count.transactions} transacción${confirmDelete._count.transactions !== 1 ? "es" : ""}. Las transacciones quedarán sin categoría.`
            : "¿Eliminar esta categoría? Esta acción no se puede deshacer."}
          onConfirm={() => {
            const id = confirmDelete.id
            setConfirmDelete(null)
            startTransition(async () => { await api.categories.remove(id); router.refresh() })
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
