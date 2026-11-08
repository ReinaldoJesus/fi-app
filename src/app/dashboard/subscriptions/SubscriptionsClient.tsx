"use client"
import { useRef, useActionState, useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"
import ConfirmDialog from "@/components/ConfirmDialog"
import { POPULAR_SUBSCRIPTIONS as POPULAR } from "@/lib/suggestions"

type Sub = {
  id: string
  name: string
  amount: number
  category: string | null
  icon: string | null
  billingDay: number | null
  active: boolean
}

const CATEGORIES = [
  { value: "streaming", label: "Streaming", emoji: "🎬" },
  { value: "musica", label: "Música", emoji: "🎵" },
  { value: "fitness", label: "Fitness", emoji: "💪" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
  { value: "cloud", label: "Cloud / Storage", emoji: "☁️" },
  { value: "productividad", label: "Productividad", emoji: "💼" },
  { value: "noticias", label: "Noticias / Lectura", emoji: "📰" },
  { value: "otro", label: "Otro", emoji: "📦" },
]

// Known services → emoji
const KNOWN: Record<string, string> = {
  netflix: "🎬", "disney+": "🏰", disney: "🏰", hbo: "📺", "hbo max": "📺",
  "paramount+": "📺", paramount: "📺", "amazon prime": "🎬", prime: "🎬",
  "apple tv": "📺", "apple tv+": "📺", crunchyroll: "🎌", twitch: "🎮",
  spotify: "🎵", "youtube music": "🎵", "apple music": "🎵", "amazon music": "🎵",
  deezer: "🎵", tidal: "🎵",
  youtube: "▶️",
  gym: "💪", gimnasio: "💪", "smart fit": "💪", smartfit: "💪",
  "crunch gym": "💪", "world gym": "💪", "fit pass": "💪",
  icloud: "☁️", "google one": "☁️", dropbox: "☁️", "onedrive": "☁️",
  "microsoft 365": "💼", "office 365": "💼", office: "💼", adobe: "🎨",
  figma: "🎨", canva: "🎨", sketch: "🎨",
  "playstation plus": "🎮", "ps plus": "🎮", playstation: "🎮",
  "xbox game pass": "🎮", xbox: "🎮", steam: "🎮", "ea play": "🎮",
  "nintendo switch": "🎮", nintendo: "🎮",
  notion: "📝", obsidian: "📝", evernote: "📝",
  slack: "💬", discord: "💬", zoom: "📹",
  duolingo: "🦉", coursera: "📚", udemy: "📚",
  "linkedin premium": "💼", linkedin: "💼",
  dazn: "⚽", espn: "⚽", "directv sports": "⚽",
  "new york times": "📰", "el mercurio": "📰",
  "1password": "🔐", lastpass: "🔐", nordvpn: "🔒", expressvpn: "🔒",
  chatgpt: "🤖", "claude ai": "🤖", midjourney: "🎨",
  audible: "🎧", "kindle unlimited": "📚",
}

const QUICK_EMOJIS = ["🎬","🎵","💪","🎮","☁️","💼","📺","🎨","📝","🏠","🚗","✈️","🍔","🐾","📚","🎧","🔐","⚽","🤖","▶️","🏰","🎌","📰","🛒"]

function suggestIcon(name: string): string | null {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const [key, emoji] of Object.entries(KNOWN)) {
    if (lower.includes(key) || key.includes(lower)) return emoji
  }
  return null
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px]"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"
const fmt = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
const categoryEmoji = (cat: string | null) => CATEGORIES.find(c => c.value === cat)?.emoji ?? "📦"
const categoryLabel = (cat: string | null) => CATEGORIES.find(c => c.value === cat)?.label ?? cat ?? "Otro"

function daysUntilBilling(day: number | null): string | null {
  if (!day) return null
  const today = new Date()
  const todayDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeft = day >= todayDay ? day - todayDay : daysInMonth - todayDay + day
  if (daysLeft === 0) return "Hoy"
  if (daysLeft === 1) return "Mañana"
  return `en ${daysLeft} días`
}

function SubForm({
  initial,
  action,
  pending,
  error,
  onCancel,
  submitLabel,
}: {
  initial?: Sub
  action: (formData: FormData) => void
  pending: boolean
  error?: string
  onCancel: () => void
  submitLabel: string
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState(initial?.icon ?? "")
  const [category, setCategory] = useState(initial?.category ?? "otro")
  const suggested = suggestIcon(name)

  function pick(p: (typeof POPULAR)[number]) {
    setName(p.name)
    setIcon(p.icon)
    setCategory(p.category)
  }

  return (
    <form action={action} className="space-y-4">
      {error && (
        <p className="text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">{error}</p>
      )}

      {!initial && (
        <div>
          <label className={labelCls}>Populares</label>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR.map(p => (
              <button key={p.name} type="button" onClick={() => pick(p)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  name === p.name
                    ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
                    : "bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white hover:bg-[#e8e8ed] dark:hover:bg-white/[0.12]"
                }`}>
                <span>{p.icon}</span>{p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name with icon suggestion */}
      <div>
        <label className={labelCls}>Nombre</label>
        <input name="name" type="text" required placeholder="Ej: Netflix, GYM, Spotify"
          value={name} onChange={e => setName(e.target.value)}
          className={inputCls} />
        {suggested && !icon && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] text-[#86868b]">Sugerido:</span>
            <button type="button" onClick={() => setIcon(suggested)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f5f5f7] dark:bg-white/[0.08] text-[13px] hover:bg-[#e8e8ed] dark:hover:bg-white/[0.12] transition-colors">
              {suggested} <span className="text-[11px] text-[#007aff] font-medium">Usar</span>
            </button>
          </div>
        )}
      </div>

      {/* Icon picker */}
      <div>
        <label className={labelCls}>Ícono</label>
        <div className="flex gap-2">
          <input name="icon" type="text" placeholder="🎵" maxLength={4}
            value={icon} onChange={e => setIcon(e.target.value)}
            className="w-20 px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[18px] text-center" />
          <div className="flex-1 grid grid-cols-8 gap-1">
            {QUICK_EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setIcon(e)}
                className={`h-9 rounded-lg text-[16px] transition-colors ${icon === e ? "bg-[#1d1d1f] dark:bg-white" : "bg-[#f5f5f7] dark:bg-white/[0.06] hover:bg-[#e8e8ed] dark:hover:bg-white/[0.12]"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Costo mensual (CLP)</label>
        <input name="amount" type="number" min="1" step="1" required placeholder="0"
          defaultValue={initial?.amount ?? ""} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Día de cobro mensual</label>
        <input name="billingDay" type="number" min="1" max="31" required placeholder="Ej: 5, 15, 28"
          defaultValue={initial?.billingDay ?? new Date().getDate()} suppressHydrationWarning className={inputCls} />
        <p className="text-[11px] text-[#86868b] mt-1.5">El día del mes en que se realiza el cobro</p>
      </div>

      <div>
        <label className={labelCls}>Categoría</label>
        <select name="category" value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80 transition-opacity">
          Cancelar
        </button>
        <button type="submit" disabled={pending}
          className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold text-[13px] transition-all">
          {pending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function SubscriptionsClient({ initialSubs, shareOfIncome }: {
  initialSubs: Sub[]
  /** % of the average monthly income (last 3 months) that subscriptions take; null without income data. */
  shareOfIncome?: number | null
}) {
  const router = useRouter()
  const addRef = useRef<HTMLDialogElement>(null)
  const editRef = useRef<HTMLDialogElement>(null)
  const [editingSub, setEditingSub] = useState<Sub | null>(null)
  const [, startTransition] = useTransition()

  const [addState, addAction, addPending] = useActionState(async (_: unknown, formData: FormData) => {
    const result = await api.subscriptions.create(formData)
    if (!result.error) { addRef.current?.close(); router.refresh(); return undefined }
    return result
  }, undefined)

  const [editState, editAction, editPending] = useActionState(async (_: unknown, formData: FormData) => {
    if (!editingSub) return undefined
    const result = await api.subscriptions.update(editingSub.id, formData)
    if (!result.error) { editRef.current?.close(); router.refresh(); return undefined }
    return result
  }, undefined)

  const toggle = (id: string, active: boolean) =>
    startTransition(async () => { await api.subscriptions.update(id, { active }); router.refresh() })
  const remove = (id: string) =>
    startTransition(async () => { await api.subscriptions.remove(id); router.refresh() })

  const sorted = [...initialSubs].sort((a, b) => {
    if (!a.active && b.active) return 1
    if (a.active && !b.active) return -1
    return (a.billingDay ?? 99) - (b.billingDay ?? 99)
  })
  const active = sorted.filter(s => s.active)
  const inactive = sorted.filter(s => !s.active)
  const totalMonthly = active.reduce((sum, s) => sum + s.amount, 0)

  function openEdit(sub: Sub) {
    setEditingSub(sub)
    editRef.current?.showModal()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Suscripciones</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5">Servicios que pagas mes a mes</p>
        </div>
        <button onClick={() => addRef.current?.showModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d1d1f] dark:bg-white hover:opacity-90 text-white dark:text-[#1d1d1f] text-[13px] font-semibold rounded-xl transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar
        </button>
      </div>

      {/* Totals */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Total mensual</p>
            <p className="text-[32px] font-semibold text-[#1d1d1f] dark:text-white mt-1 tracking-tight">{fmt(totalMonthly)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Activas</p>
            <p className="text-[32px] font-semibold text-[#1d1d1f] dark:text-white mt-1">{active.length}</p>
          </div>
        </div>
        {active.length > 0 && (
          <div className="mt-4 pt-4 border-t border-black/[0.04] dark:border-white/[0.05] grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-[#86868b] mb-0.5">Al año</p>
              <p className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">{fmt(totalMonthly * 12)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#86868b] mb-0.5">Por día</p>
              <p className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">{fmt(Math.round(totalMonthly / 30))}</p>
            </div>
          </div>
        )}
        {active.length > 0 && shareOfIncome != null && (
          <p className="mt-3 text-[12px] text-[#86868b]">
            Equivale al <span className="font-semibold text-[#1d1d1f] dark:text-white">{shareOfIncome.toLocaleString("es-CL")}%</span> de tus ingresos mensuales (promedio de los últimos 3 meses).
          </p>
        )}
      </div>

      {/* Active */}
      {active.length === 0 ? (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] p-10 text-center">
          <p className="text-[32px] mb-3">📋</p>
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white mb-1">Sin suscripciones</p>
          <p className="text-[13px] text-[#86868b]">Agrega tus servicios recurrentes para llevar el control.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(sub => (
            <SubCard key={sub.id} sub={sub}
              onEdit={() => openEdit(sub)}
              onToggle={toggle}
              onDelete={remove} />
          ))}
        </div>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">Pausadas</p>
          <div className="space-y-2 opacity-60">
            {inactive.map(sub => (
              <SubCard key={sub.id} sub={sub}
                onEdit={() => openEdit(sub)}
                onToggle={toggle}
                onDelete={remove} />
            ))}
          </div>
        </div>
      )}

      {/* Add dialog */}
      <dialog ref={addRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={(e) => { if (e.target === e.currentTarget) addRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Nueva suscripción</h3>
          <button type="button" onClick={() => addRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <SubForm action={addAction} pending={addPending} error={addState?.error}
          onCancel={() => addRef.current?.close()} submitLabel="Agregar" />
      </dialog>

      {/* Edit dialog */}
      <dialog ref={editRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={(e) => { if (e.target === e.currentTarget) editRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Editar suscripción</h3>
          <button type="button" onClick={() => editRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {editingSub && (
          <SubForm key={editingSub.id} initial={editingSub} action={editAction} pending={editPending}
            error={editState?.error} onCancel={() => editRef.current?.close()} submitLabel="Guardar cambios" />
        )}
      </dialog>
    </>
  )
}

function SubCard({ sub, onEdit, onToggle, onDelete }: {
  sub: Sub
  onEdit: () => void
  onToggle: (id: string, v: boolean) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const billingLabel = daysUntilBilling(sub.billingDay)
  const isUrgent = billingLabel === "Hoy" || billingLabel === "Mañana"

  return (
    <>
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none p-4">
      {/* Top row: icon + name + actions */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.07] flex items-center justify-center text-[20px] flex-shrink-0">
          {sub.icon || categoryEmoji(sub.category)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white truncate">{sub.name}</p>
          <p className="text-[12px] text-[#86868b] mt-0.5">{categoryLabel(sub.category)}</p>
        </div>
        {/* Action buttons always visible */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} title="Editar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onToggle(sub.id, !sub.active)} title={sub.active ? "Pausar" : "Activar"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            {sub.active
              ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" /></svg>
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-5.197-3.03A1 1 0 008 9v6a1 1 0 001.555.832l5.197-3.03a1 1 0 000-1.664z" /></svg>
            }
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Eliminar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      {/* Bottom row: billing info + amounts */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.05]">
        <div>
          {sub.billingDay ? (
            <span className={`text-[12px] font-medium ${isUrgent ? "text-[#ff9500]" : "text-[#86868b]"}`}>
              Cobra el día {sub.billingDay}{billingLabel ? ` · ${billingLabel}` : ""}
            </span>
          ) : (
            <span className="text-[12px] text-[#86868b]">Sin día de cobro</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">{fmt(sub.amount)}<span className="text-[11px] font-normal text-[#86868b]">/mes</span></span>
          <span className="text-[11px] text-[#86868b] ml-2">{fmt(sub.amount * 12)}/año</span>
        </div>
      </div>
    </div>
    {confirmDelete && (
      <ConfirmDialog
        title={`Eliminar "${sub.name}"`}
        message="¿Eliminar esta suscripción? Esta acción no se puede deshacer."
        onConfirm={() => { setConfirmDelete(false); onDelete(sub.id) }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  )
}
