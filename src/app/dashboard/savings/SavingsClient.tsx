"use client"
import { useRef, useState, useTransition, useActionState } from "react"
import { api } from "@/lib/api/client"
import { useRouter } from "next/navigation"
import ConfirmDialog from "@/components/ConfirmDialog"

type Goal = {
  id: string; name: string; icon: string | null; color: string
  targetAmount: number; currentAmount: number; deadline: string | null; completed: boolean
}

const fmt = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
const COLORS = ["#34c759", "#007aff", "#ff9500", "#ff3b30", "#bf5af2", "#ff2d55", "#5ac8fa", "#ffcc00"]
const ICONS = ["🎯", "🏖️", "🏠", "🚗", "✈️", "💻", "💍", "🎓", "🛒", "🏋️", "📱", "🎸", "🌎", "🏦", "💰", "🚀"]

const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px]"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"

function GoalForm({ initial, action, pending, error, onCancel, submitLabel }: {
  initial?: Goal; action: (fd: FormData) => void; pending: boolean
  error?: string; onCancel: () => void; submitLabel: string
}) {
  const [icon, setIcon] = useState(initial?.icon ?? "🎯")
  const [color, setColor] = useState(initial?.color ?? "#34c759")
  const [targetAmount, setTargetAmount] = useState(initial?.targetAmount?.toString() ?? "")
  const [currentAmount, setCurrentAmount] = useState(initial?.currentAmount?.toString() ?? "0")

  const target = parseFloat(targetAmount) || 0
  const current = parseFloat(currentAmount) || 0
  const amountError = target > 0 && current > target ? "El monto actual no puede superar el objetivo." : null

  return (
    <form action={action} className="space-y-4">
      {(error || amountError) && (
        <p className="text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">
          {error ?? amountError}
        </p>
      )}

      <div>
        <label className={labelCls}>Nombre</label>
        <input name="name" type="text" required placeholder="Ej: Vacaciones, Auto nuevo..." defaultValue={initial?.name ?? ""} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Monto objetivo (CLP)</label>
          <input name="targetAmount" type="number" min="1" step="1" required
            value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ya tienes (CLP)</label>
          <input name="currentAmount" type="number" min="0" step="1"
            value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Fecha límite (opcional)</label>
        <input name="deadline" type="date" defaultValue={initial?.deadline ? initial.deadline.slice(0, 10) : ""} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Ícono</label>
        <div className="grid grid-cols-8 gap-1.5">
          {ICONS.map(e => (
            <button key={e} type="button" onClick={() => setIcon(e)}
              className={`h-9 rounded-xl text-[16px] transition-all ${icon === e ? "bg-[#1d1d1f] dark:bg-white scale-110" : "bg-[#f5f5f7] dark:bg-white/[0.06] hover:bg-[#e8e8ed] dark:hover:bg-white/[0.12]"}`}>
              {e}
            </button>
          ))}
        </div>
        <input type="hidden" name="icon" value={icon} />
      </div>

      <div>
        <label className={labelCls}>Color</label>
        <input name="color" type="hidden" value={color} />
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-black/30 dark:ring-white/30 scale-110" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80 transition-opacity">Cancelar</button>
        <button type="submit" disabled={pending || !!amountError} className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold text-[13px] transition-all">
          {pending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  )
}

function ContributeDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const [amount, setAmount] = useState("")
  const [, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    const n = parseFloat(amount.replace(/\./g, "").replace(",", "."))
    if (!n || n <= 0) return
    startTransition(async () => {
      await api.savingsGoals.contribute(goal.id, n)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-black/[0.08] dark:border-white/[0.08] anim-pop-in">
        <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white mb-1">Abonar a meta</h3>
        <p className="text-[13px] text-[#86868b] mb-4">{goal.name} · {fmt(goal.currentAmount)} de {fmt(goal.targetAmount)}</p>
        <input
          type="number" min="1" step="1" placeholder="Monto a abonar (CLP)"
          value={amount} onChange={e => setAmount(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose() }}
          className={inputCls + " mb-4"}
        />
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold">Cancelar</button>
          <button onClick={submit} className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold hover:opacity-90">Abonar</button>
        </div>
      </div>
    </div>
  )
}

export default function SavingsClient({ goals }: { goals: Goal[] }) {
  const addRef = useRef<HTMLDialogElement>(null)
  const editRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [editing, setEditing] = useState<Goal | null>(null)
  const [contributing, setContributing] = useState<Goal | null>(null)
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<Goal | null>(null)
  const [, startTransition] = useTransition()

  const [addState, addAction, addPending] = useActionState(async (_: unknown, fd: FormData) => {
    const r = await api.savingsGoals.create(fd)
    if (!r.error) { addRef.current?.close(); router.refresh(); return undefined }
    return r
  }, undefined)

  const [editState, editAction, editPending] = useActionState(async (_: unknown, fd: FormData) => {
    if (!editing) return undefined
    const r = await api.savingsGoals.update(editing.id, fd)
    if (!r.error) { editRef.current?.close(); router.refresh(); return undefined }
    return r
  }, undefined)

  const [now] = useState(() => Date.now())
  const active = goals.filter(g => !g.completed)
  const completed = goals.filter(g => g.completed)
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0)

  function daysLeft(deadline: string | null) {
    if (!deadline) return null
    return Math.ceil((new Date(deadline).getTime() - now) / 86400000)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Metas de ahorro</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5">{active.length} meta{active.length !== 1 ? "s" : ""} activa{active.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => addRef.current?.showModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d1d1f] dark:bg-white hover:opacity-90 text-white dark:text-[#1d1d1f] text-[13px] font-semibold rounded-xl transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nueva meta
        </button>
      </div>

      {/* Summary */}
      {active.length > 0 && (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-6">
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Total ahorrado</p>
              <p className="text-[24px] font-semibold text-[#1d1d1f] dark:text-white mt-1">{fmt(totalSaved)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Objetivo total</p>
              <p className="text-[24px] font-semibold text-[#1d1d1f] dark:text-white mt-1">{fmt(totalTarget)}</p>
            </div>
          </div>
          <div className="h-2 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#34c759] transition-all duration-700"
              style={{ width: `${totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0}%` }} />
          </div>
          <p className="text-[11px] text-[#86868b] mt-2">
            {fmt(Math.max(0, totalTarget - totalSaved))} restante · {totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0}% completado
          </p>
        </div>
      )}

      {/* Active goals */}
      {active.length === 0 ? (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none px-5 py-12 text-center mb-6">
          <p className="text-[28px] mb-2">🎯</p>
          <p className="text-[15px] font-medium text-[#1d1d1f] dark:text-white">Sin metas aún</p>
          <p className="text-[13px] text-[#86868b] mt-1">Crea tu primera meta y empieza a ahorrar con propósito.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {active.map(goal => {
            const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0
            const days = daysLeft(goal.deadline)
            return (
              <div key={goal.id} className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[20px] flex-shrink-0" style={{ backgroundColor: `${goal.color}20` }}>
                    {goal.icon ?? "🎯"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">{goal.name}</p>
                    <p className="text-[12px] text-[#86868b] mt-0.5">
                      {fmt(goal.currentAmount)} de {fmt(goal.targetAmount)}
                      {days !== null && (
                        <span className={days < 0 ? " text-[#ff3b30] font-medium" : days <= 7 ? " text-[#ff9500] font-medium" : ""}>
                          {" · "}{days < 0 ? `Venció hace ${Math.abs(days)} días` : days === 0 ? "Vence hoy" : `${days} días restantes`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setContributing(goal)}
                      className="px-3 py-1.5 rounded-lg bg-[#34c759] text-white text-[11px] font-semibold hover:opacity-80 transition-opacity">
                      + Abonar
                    </button>
                    <button onClick={() => { setEditing(goal); editRef.current?.showModal() }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => setConfirmDeleteGoal(goal)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <div className="h-2.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-[#86868b]">{pct}% completado</p>
                  <p className="text-[11px] font-medium text-[#86868b]">{fmt(goal.targetAmount - goal.currentAmount)} restante</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed goals */}
      {completed.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">Completadas</p>
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none divide-y divide-black/[0.06] dark:divide-white/[0.05] opacity-70">
            {completed.map(goal => (
              <div key={goal.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[16px]" style={{ backgroundColor: `${goal.color}20` }}>
                  {goal.icon ?? "🎯"}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">{goal.name}</p>
                  <p className="text-[11px] text-[#34c759] font-medium">✓ Completada · {fmt(goal.targetAmount)}</p>
                </div>
                <button onClick={() => setConfirmDeleteGoal(goal)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {contributing && <ContributeDialog goal={contributing} onClose={() => setContributing(null)} />}

      {/* Add dialog */}
      <dialog ref={addRef} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto" onClick={e => { if (e.target === e.currentTarget) addRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Nueva meta</h3>
          <button type="button" onClick={() => addRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <GoalForm action={addAction} pending={addPending} error={addState?.error} onCancel={() => addRef.current?.close()} submitLabel="Crear meta" />
      </dialog>

      {/* Edit dialog */}
      <dialog ref={editRef} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto" onClick={e => { if (e.target === e.currentTarget) editRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Editar meta</h3>
          <button type="button" onClick={() => editRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {editing && <GoalForm key={editing.id} initial={editing} action={editAction} pending={editPending} error={editState?.error} onCancel={() => editRef.current?.close()} submitLabel="Guardar" />}
      </dialog>

      {confirmDeleteGoal && (
        <ConfirmDialog
          title={`Eliminar "${confirmDeleteGoal.name}"`}
          message="¿Eliminar esta meta de ahorro? Esta acción no se puede deshacer."
          onConfirm={() => {
            const goal = confirmDeleteGoal
            setConfirmDeleteGoal(null)
            startTransition(async () => { await api.savingsGoals.remove(goal.id); router.refresh() })
          }}
          onCancel={() => setConfirmDeleteGoal(null)}
        />
      )}
    </>
  )
}
