"use client"
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import BrandMark from "@/components/BrandMark"
import { LoadingScreen } from "@/components/BrandLoader"
import SubmitOverlay from "@/components/SubmitOverlay"
import { signup, loginWithGitHub, loginWithGoogle } from "@/app/actions/auth"
import {
  ACCOUNT_TYPES, BANKS, BUDGET_PRESETS, GOAL_AMOUNTS, GOAL_DEADLINES, GOAL_PRESETS, POPULAR_SUBSCRIPTIONS,
  accountName, fmtCLP, fmtShort, monthsFromNow, type AccountTypeValue,
} from "@/lib/suggestions"
import { SETUP_DRAFT_KEY, type SetupDraft } from "@/components/PendingSetup"

/* ─── Draft (everything except the password survives a reload) ─────────────── */

type Sub = { name: string; icon: string; category: string; amount: string }
type Draft = {
  name: string
  account: { type: AccountTypeValue; bank: string; balance: string; creditLimit: string; skip: boolean }
  subs: Sub[]
  goal: { name: string; icon: string; color: string; target: string; months: number | null; skip: boolean }
  budgets: Record<string, string>
}

const EMPTY: Draft = {
  name: "",
  account: { type: "CHECKING", bank: "", balance: "", creditLimit: "", skip: false },
  subs: [],
  goal: { name: "", icon: "", color: "#34c759", target: "", months: 12, skip: false },
  budgets: {},
}

const STEPS = [
  { id: "name", title: "Empecemos por ti", hint: "Así te saludaremos cada vez que entres." },
  { id: "account", title: "Tu primera cuenta", hint: "Dónde tienes tu plata hoy. Después puedes sumar más." },
  { id: "subs", title: "¿Qué pagas cada mes?", hint: "Toca tus servicios y te avisaremos antes de cada cobro." },
  { id: "goal", title: "¿Para qué estás ahorrando?", hint: "Una meta clara hace que ahorrar sea más fácil." },
  { id: "budget", title: "Tus límites del mes", hint: "Elige cuánto quieres gastar. Te avisamos al 90%." },
  { id: "access", title: "Guarda tu Clarifi", hint: "Último paso: crea tu acceso para no perder nada." },
] as const

const num = (s: string) => Math.max(0, Number(String(s).replace(/\D/g, "")) || 0)

/** The payload for POST /api/v1/me/setup (or the "setup" field of the signup). */
function toSetup(d: Draft) {
  const isCredit = d.account.type === "CREDIT_CARD"
  const bank = d.account.bank.trim()
  return {
    account: d.account.skip ? undefined : {
      name: accountName(d.account.type, bank || null),
      type: d.account.type,
      bank: bank || undefined,
      color: BANKS.find(b => b.name === bank)?.color ?? "#007aff",
      currency: "CLP",
      ...(isCredit
        ? { usedAmount: num(d.account.balance), creditLimit: num(d.account.creditLimit) || undefined }
        : { balance: num(d.account.balance) }),
    },
    subscriptions: d.subs.filter(s => num(s.amount) > 0).map(s => ({
      name: s.name, icon: s.icon, category: s.category, amount: num(s.amount), currency: "CLP", billingDay: new Date().getDate(),
    })),
    goal: d.goal.skip || !d.goal.name.trim() || num(d.goal.target) <= 0 ? undefined : {
      name: d.goal.name.trim(), icon: d.goal.icon || "🎯", color: d.goal.color, targetAmount: num(d.goal.target), currentAmount: 0,
      deadline: d.goal.months ? monthsFromNow(d.goal.months) : null,
    },
    budgets: Object.entries(d.budgets).filter(([, v]) => num(v) > 0).map(([category, v]) => ({ category, amount: num(v) })),
  }
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(SETUP_DRAFT_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as SetupDraft
      if (saved.form) return { ...EMPTY, ...(saved.form as Draft) }
    }
  } catch { /* storage unavailable */ }
  return EMPTY
}

/* ─── UI atoms ───────────────────────────────────────────────────────────────── */

const inputCls = "w-full px-4 py-3 rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 text-[15px] transition-all"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-2"

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.94 }} layout
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium border transition-colors ${
        active
          ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] border-transparent"
          : "bg-white dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white border-black/[0.08] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20"
      }`}>
      {children}
    </motion.button>
  )
}

function MoneyInput({ value, onChange, placeholder = "0", autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const n = num(value)
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] text-[15px]">$</span>
      <input inputMode="numeric" autoFocus={autoFocus} placeholder={placeholder}
        value={n ? n.toLocaleString("es-CL") : ""}
        onChange={e => onChange(e.target.value.replace(/\D/g, ""))}
        className={`${inputCls} pl-8 tabular-nums`} />
    </div>
  )
}

/* ─── Live preview: what they are building (IKEA effect) ────────────────────── */

function Preview({ d }: { d: Draft }) {
  const s = toSetup(d)
  const subsTotal = s.subscriptions.reduce((a, x) => a + x.amount, 0)
  const acc = s.account
  const accBalance = acc ? ("usedAmount" in acc ? -(acc.usedAmount ?? 0) : acc.balance ?? 0) : 0
  return (
    <div className="w-full max-w-sm space-y-3">
      <p className="text-[11px] font-semibold text-white/45 uppercase tracking-[0.14em]">Tu Clarifi</p>
      <motion.p layout className="text-[28px] font-semibold tracking-tight leading-tight">
        {d.name.trim() ? `Hola, ${d.name.trim().split(" ")[0]}` : "Hola 👋"}
      </motion.p>

      <AnimatePresence initial={false}>
        {acc && (
          <motion.div key="acc" layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-2xl p-5 text-white shadow-2xl" style={{ background: `linear-gradient(135deg, ${acc.color}, ${acc.color}99)` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{acc.bank ?? "Mi cuenta"}</p>
            <p className="text-[14px] font-medium mt-0.5">{acc.name}</p>
            <p className="text-[26px] font-semibold tabular-nums mt-6">{fmtCLP(accBalance)}</p>
          </motion.div>
        )}

        {s.subscriptions.length > 0 && (
          <motion.div key="subs" layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-white/[0.07] border border-white/10 p-4">
            <div className="flex justify-between text-[12px] text-white/55 mb-2">
              <span>Cobros mensuales</span><span className="tabular-nums">{fmtCLP(subsTotal)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {s.subscriptions.map(x => (
                  <motion.span key={x.name} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    className="px-2.5 py-1 rounded-full bg-white/10 text-[12px]">{x.icon} {x.name}</motion.span>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {s.goal && (
          <motion.div key="goal" layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-white/[0.07] border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-medium">{s.goal.icon} {s.goal.name}</p>
              <p className="text-[12px] text-white/55 tabular-nums">{fmtCLP(s.goal.targetAmount)}</p>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 mt-3 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ backgroundColor: s.goal.color }} initial={{ width: 0 }} animate={{ width: "4%" }} />
            </div>
            {d.goal.months && (
              <p className="text-[11px] text-white/45 mt-2">
                Ahorrando {fmtCLP(Math.ceil(s.goal.targetAmount / d.goal.months / 1000) * 1000)} al mes
              </p>
            )}
          </motion.div>
        )}

        {s.budgets.length > 0 && (
          <motion.div key="budgets" layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-white/[0.07] border border-white/10 p-4 space-y-2">
            {s.budgets.map(b => (
              <div key={b.category} className="flex justify-between text-[13px]">
                <span className="text-white/70">{BUDGET_PRESETS.find(p => p.category === b.category)?.icon} {b.category}</span>
                <span className="tabular-nums">{fmtCLP(b.amount)}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MobileSummary({ d }: { d: Draft }) {
  const s = toSetup(d)
  const items = [
    s.account && { key: "acc", label: `${ACCOUNT_TYPES.find(t => t.value === s.account!.type)?.icon} ${s.account.bank ?? s.account.name}` },
    s.subscriptions.length > 0 && { key: "subs", label: `📅 ${s.subscriptions.length} ${s.subscriptions.length === 1 ? "cobro" : "cobros"}` },
    s.goal && { key: "goal", label: `${s.goal.icon} ${s.goal.name}` },
    s.budgets.length > 0 && { key: "bud", label: `📊 ${s.budgets.length} ${s.budgets.length === 1 ? "límite" : "límites"}` },
  ].filter(Boolean) as { key: string; label: string }[]
  if (!items.length) return null
  return (
    <div className="lg:hidden w-full max-w-md mx-auto mt-4 flex flex-wrap gap-1.5">
      <AnimatePresence initial={false}>
        {items.map(i => (
          <motion.span key={i.key} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="px-2.5 py-1 rounded-full bg-[#34c759]/[0.12] text-[#248a3d] dark:text-[#30d158] text-[12px] font-medium max-w-full truncate">
            {i.label}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ─── Wizard ─────────────────────────────────────────────────────────────────── */

export default function SignupWizard() {
  const [state, action, pending] = useActionState(signup, undefined)
  const [d, setD] = useState<Draft>(EMPTY)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Restore a draft after mount (localStorage is client-only).
  useEffect(() => {
    const saved = loadDraft()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
    setD(saved)
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify({ form: d } satisfies SetupDraft)) } catch { /* ignore */ }
  }, [d, loaded])

  // Server errors about the name send them back to that step.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server's answer
    if (state?.errors?.name) { setDir(-1); setStep(0) }
  }, [state])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }))
  const total = STEPS.length
  // Goal gradient: the bar is never empty — being here already counts.
  const progress = Math.round(((step + 1) / (total + 1)) * 100)
  const current = STEPS[step]
  const canNext = step !== 0 || d.name.trim().length >= 2

  function go(delta: number) {
    setDir(delta)
    setStep(s => Math.min(total - 1, Math.max(0, s + delta)))
  }

  /** Keep the draft for after a Google/GitHub round-trip; the dashboard applies it. */
  function handoff() {
    try { localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify({ form: d, handoff: toSetup(d) } satisfies SetupDraft)) } catch { /* ignore */ }
  }

  const sub = (name: string) => d.subs.find(s => s.name === name)
  function toggleSub(p: (typeof POPULAR_SUBSCRIPTIONS)[number]) {
    set("subs", sub(p.name) ? d.subs.filter(s => s.name !== p.name) : [...d.subs, { name: p.name, icon: p.icon, category: p.category, amount: "" }])
  }

  const variants = {
    enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-[#f2f2f7] dark:bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {pending && <LoadingScreen overlay label="Creando tu Clarifi…" />}

        {/* Live preview (desktop) */}
        <aside className="relative hidden lg:flex flex-col justify-center items-center overflow-hidden bg-[#1d1d1f] dark:bg-[#111111] text-white p-12">
          <div className="pointer-events-none absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#007aff]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-20 w-[26rem] h-[26rem] rounded-full bg-[#34c759]/10 blur-3xl" />
          <div className="absolute top-12 left-12 flex items-center gap-3">
            <BrandMark size={36} inverted />
            <p className="text-[17px] font-semibold tracking-tight">Clarifi</p>
          </div>
          <div className="relative w-full flex justify-center"><Preview d={d} /></div>
        </aside>

        {/* Steps */}
        <main className="flex flex-col px-4 sm:px-10 py-6 lg:py-10 min-w-0">
          <header className="w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 lg:invisible">
                <BrandMark size={28} />
                <span className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Clarifi</span>
              </div>
              <Link href="/login" className="text-[13px] text-[#007aff] font-medium hover:opacity-70">Ya tengo cuenta</Link>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-between text-[12px] mb-2">
              <span className="font-semibold text-[#1d1d1f] dark:text-white">Paso {step + 1} de {total}</span>
              <motion.span key={progress} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[#86868b] tabular-nums">
                {progress}% listo
              </motion.span>
            </div>
            <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#007aff] to-[#34c759]"
                initial={false} animate={{ width: `${progress}%` }} />
            </div>
            <div className="flex gap-1.5 mt-2.5">
              {STEPS.map((s, i) => (
                <motion.span key={s.id} className="h-1 flex-1 rounded-full"
                  animate={{ backgroundColor: i <= step ? "#34c759" : "rgba(134,134,139,0.25)" }} />
              ))}
            </div>
          </header>

          {/* What you've built so far (phones; the big preview is desktop-only) */}
          <MobileSummary d={d} />

          <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto py-8 overflow-x-hidden">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.section key={current.id} custom={dir} variants={variants} initial="enter" animate="center" exit="exit">
                <h1 className="text-[26px] sm:text-[30px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight leading-tight">{current.title}</h1>
                <p className="text-[14px] text-[#86868b] mt-1.5 mb-6">{current.hint}</p>

                {current.id === "name" && (
                  <form onSubmit={e => { e.preventDefault(); if (canNext) go(1) }}>
                    <label className={labelCls}>¿Cómo te llamas?</label>
                    <input autoFocus value={d.name} onChange={e => set("name", e.target.value)} placeholder="Tu nombre" autoComplete="given-name" className={inputCls} />
                    {state?.errors?.name && <p className="mt-2 text-[12px] text-[#ff3b30]">{state.errors.name[0]}</p>}
                  </form>
                )}

                {current.id === "account" && (
                  <div className="space-y-5">
                    <div>
                      <label className={labelCls}>Tipo</label>
                      <div className="flex flex-wrap gap-2">
                        {ACCOUNT_TYPES.map(t => (
                          <Chip key={t.value} active={d.account.type === t.value} onClick={() => set("account", { ...d.account, type: t.value, skip: false })}>
                            <span>{t.icon}</span>{t.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    {d.account.type !== "CASH" && (
                      <div>
                        <label className={labelCls}>Banco</label>
                        <div className="flex flex-wrap gap-2">
                          {BANKS.map(b => (
                            <Chip key={b.name} active={d.account.bank === b.name}
                              onClick={() => set("account", { ...d.account, bank: d.account.bank === b.name ? "" : b.name, skip: false })}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />{b.name}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}
                    {d.account.type === "CREDIT_CARD" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelCls}>Cupo usado</label>
                          <MoneyInput value={d.account.balance} onChange={v => set("account", { ...d.account, balance: v })} /></div>
                        <div><label className={labelCls}>Cupo total</label>
                          <MoneyInput value={d.account.creditLimit} onChange={v => set("account", { ...d.account, creditLimit: v })} /></div>
                      </div>
                    ) : (
                      <div><label className={labelCls}>¿Cuánto tienes hoy? (aprox.)</label>
                        <MoneyInput value={d.account.balance} onChange={v => set("account", { ...d.account, balance: v })} /></div>
                    )}
                  </div>
                )}

                {current.id === "subs" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_SUBSCRIPTIONS.map(p => (
                        <Chip key={p.name} active={!!sub(p.name)} onClick={() => toggleSub(p)}><span>{p.icon}</span>{p.name}</Chip>
                      ))}
                    </div>
                    <AnimatePresence initial={false}>
                      {d.subs.map((s, i) => (
                        <motion.div key={s.name} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-3 overflow-hidden">
                          <span className="w-32 flex-shrink-0 text-[14px] text-[#1d1d1f] dark:text-white truncate">{s.icon} {s.name}</span>
                          <div className="flex-1 min-w-0">
                            <MoneyInput value={s.amount} placeholder="Monto mensual" autoFocus={i === d.subs.length - 1}
                              onChange={v => set("subs", d.subs.map(x => (x.name === s.name ? { ...x, amount: v } : x)))} />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {d.subs.some(s => !num(s.amount)) && <p className="text-[12px] text-[#86868b]">Los que queden sin monto no se guardan.</p>}
                  </div>
                )}

                {current.id === "goal" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      {GOAL_PRESETS.map(g => (
                        <Chip key={g.name} active={d.goal.name === g.name}
                          onClick={() => set("goal", { ...d.goal, name: g.name, icon: g.icon, color: g.color, skip: false })}>
                          <span>{g.icon}</span>{g.name}
                        </Chip>
                      ))}
                    </div>
                    <div>
                      <label className={labelCls}>O escribe la tuya</label>
                      <input value={GOAL_PRESETS.some(g => g.name === d.goal.name) ? "" : d.goal.name} placeholder="Ej: Matrimonio"
                        onChange={e => set("goal", { ...d.goal, name: e.target.value, icon: "🎯", skip: false })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>¿Cuánto necesitas?</label>
                      <div className="flex flex-wrap gap-2 mb-2.5">
                        {GOAL_AMOUNTS.map(a => (
                          <Chip key={a} active={num(d.goal.target) === a} onClick={() => set("goal", { ...d.goal, target: String(a) })}>{fmtShort(a)}</Chip>
                        ))}
                      </div>
                      <MoneyInput value={d.goal.target} onChange={v => set("goal", { ...d.goal, target: v })} />
                    </div>
                    <div>
                      <label className={labelCls}>¿Para cuándo?</label>
                      <div className="flex flex-wrap gap-2">
                        {GOAL_DEADLINES.map(o => (
                          <Chip key={o.months} active={d.goal.months === o.months} onClick={() => set("goal", { ...d.goal, months: o.months })}>{o.label}</Chip>
                        ))}
                        <Chip active={d.goal.months === null} onClick={() => set("goal", { ...d.goal, months: null })}>Sin fecha</Chip>
                      </div>
                      {d.goal.months && num(d.goal.target) > 0 && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-[#34c759] font-medium mt-3">
                          Son {fmtCLP(Math.ceil(num(d.goal.target) / d.goal.months / 1000) * 1000)} al mes.
                        </motion.p>
                      )}
                    </div>
                  </div>
                )}

                {current.id === "budget" && (
                  <div className="space-y-5">
                    {BUDGET_PRESETS.map(b => (
                      <div key={b.category}>
                        <label className={labelCls}>{b.icon} {b.category}</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {b.amounts.map(a => (
                            <Chip key={a} active={num(d.budgets[b.category] ?? "") === a}
                              onClick={() => set("budgets", { ...d.budgets, [b.category]: num(d.budgets[b.category] ?? "") === a ? "" : String(a) })}>
                              {fmtShort(a)}
                            </Chip>
                          ))}
                        </div>
                        <MoneyInput value={d.budgets[b.category] ?? ""} placeholder="Otro monto"
                          onChange={v => set("budgets", { ...d.budgets, [b.category]: v })} />
                      </div>
                    ))}
                  </div>
                )}

                {current.id === "access" && (
                  <form ref={formRef} action={action} className="space-y-3"
                    onSubmit={() => { try { localStorage.removeItem(SETUP_DRAFT_KEY) } catch { /* ignore */ } }}>
                    {state?.message && (
                      <div className="px-4 py-3 rounded-xl bg-[#ff3b30]/[0.08] border border-[#ff3b30]/20 text-[#ff3b30] text-[13px]">{state.message}</div>
                    )}
                    <input type="hidden" name="name" value={d.name.trim()} />
                    <input type="hidden" name="setup" value={JSON.stringify(toSetup(d))} />
                    {[
                      { id: "email", label: "Email", type: "email", placeholder: "tu@email.com", auto: "email" },
                      { id: "password", label: "Contraseña", type: "password", placeholder: "Mínimo 8 caracteres, una mayúscula y un número", auto: "new-password" },
                      { id: "confirmPassword", label: "Confirmar contraseña", type: "password", placeholder: "Repite tu contraseña", auto: "new-password" },
                    ].map(f => (
                      <div key={f.id}>
                        <label className={labelCls}>{f.label}</label>
                        <input name={f.id} type={f.type} required placeholder={f.placeholder} autoComplete={f.auto} className={inputCls} />
                        {state?.errors?.[f.id] && <p className="mt-1.5 text-[12px] text-[#ff3b30]">{state.errors[f.id]![0]}</p>}
                      </div>
                    ))}
                    <motion.button type="submit" disabled={pending} whileTap={{ scale: 0.98 }}
                      className="w-full py-3.5 bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold rounded-2xl text-[15px] mt-2">
                      Crear mi Clarifi
                    </motion.button>
                    <p className="text-[11px] text-[#86868b] text-center leading-relaxed">
                      Al crear tu cuenta aceptas los <Link href="/terms" className="text-[#007aff]">Términos de uso</Link> y la{" "}
                      <Link href="/privacy" className="text-[#007aff]">Política de privacidad</Link>.
                    </p>
                  </form>
                )}

                {current.id === "access" && (
                  <div className="mt-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
                      <span className="text-[12px] text-[#86868b]">o continúa con</span>
                      <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <form action={loginWithGoogle} onSubmit={handoff}>
                        <SubmitOverlay label="Conectando con Google…" />
                        <button type="submit" className="w-full py-3 bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] hover:opacity-80 rounded-2xl text-[13px] font-medium text-[#1d1d1f] dark:text-white">Google</button>
                      </form>
                      <form action={loginWithGitHub} onSubmit={handoff}>
                        <SubmitOverlay label="Conectando con GitHub…" />
                        <button type="submit" className="w-full py-3 bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] hover:opacity-80 rounded-2xl text-[13px] font-medium text-[#1d1d1f] dark:text-white">GitHub</button>
                      </form>
                    </div>
                  </div>
                )}
              </motion.section>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          {current.id !== "access" ? (
            <footer className="w-full max-w-md mx-auto flex items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={() => go(-1)}
                  className="px-5 py-3.5 rounded-2xl bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-[14px] font-semibold text-[#1d1d1f] dark:text-white">
                  Atrás
                </button>
              )}
              {step > 0 && (
                <button type="button" onClick={() => {
                  if (current.id === "account") set("account", { ...d.account, skip: true })
                  if (current.id === "subs") set("subs", [])
                  if (current.id === "goal") set("goal", { ...d.goal, skip: true })
                  if (current.id === "budget") set("budgets", {})
                  go(1)
                }} className="text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white px-2">
                  Omitir
                </button>
              )}
              <motion.button type="button" disabled={!canNext} onClick={() => go(1)} whileTap={{ scale: 0.98 }}
                className="flex-1 py-3.5 rounded-2xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[15px] font-semibold disabled:opacity-30">
                Continuar
              </motion.button>
            </footer>
          ) : (
            <footer className="w-full max-w-md mx-auto">
              <button type="button" onClick={() => go(-1)} className="text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">← Atrás</button>
            </footer>
          )}
        </main>
      </div>
    </MotionConfig>
  )
}
