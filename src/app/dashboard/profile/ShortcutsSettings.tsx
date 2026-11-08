"use client"
import { useEffect, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { api, type ApiToken } from "@/lib/api/client"
import ShortcutGuide from "./ShortcutGuide"

const card = "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-6"

/**
 * While the guide is open the person keeps jumping to the Shortcuts app; iOS may
 * reload this page meanwhile, so the guide (step + personal URL) survives in this
 * device's storage until they finish it.
 */
const GUIDE_KEY = "clarifi-shortcut-guide"
type Guide = { token: string; step: number }
const loadGuide = (): Guide | null => { try { return JSON.parse(localStorage.getItem(GUIDE_KEY) ?? "null") } catch { return null } }
const saveGuide = (g: Guide | null) => { try { if (g) localStorage.setItem(GUIDE_KEY, JSON.stringify(g)); else localStorage.removeItem(GUIDE_KEY) } catch { /* ignore */ } }

const ago = (iso: string | null) => {
  if (!iso) return "Nunca usado"
  const d = new Date(iso)
  return `Último uso: ${d.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
}

/**
 * "Pagos con Apple Pay": creates a personal URL and walks the person, screen by
 * screen, through the iPhone Shortcuts automation that sends each Wallet payment.
 */
export default function ShortcutsSettings() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null)
  const [guide, setGuide] = useState<Guide | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window/localStorage are client-only
    setOrigin(window.location.origin)
    setGuide(loadGuide())
    api.me.tokens.list().then(r => setTokens(r.ok ? r.data : []))
  }, [])

  const update = (g: Guide | null) => { setGuide(g); saveGuide(g) }
  const url = guide ? `${origin}/api/v1/shortcuts/${guide.token}` : ""

  async function create() {
    setBusy(true); setMsg(null)
    const r = await api.me.tokens.create({ name: "Atajos del iPhone" })
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    const { token, ...row } = r.data
    update({ token, step: 0 })
    setTokens(t => [row, ...(t ?? [])])
  }

  async function revoke(id: string) {
    setBusy(true)
    const r = await api.me.tokens.revoke(id)
    setBusy(false)
    if (!r.ok) return
    setTokens(t => (t ?? []).filter(x => x.id !== id))
    if (guide && tokens?.find(t => t.id === id)?.prefix === guide.token.slice(0, 8)) update(null)
  }

  /** Sends a fake payment with dryRun: checks the URL and shows how it would be recorded. */
  async function test() {
    if (!guide) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: "$4.990", merchant: "Prueba Apple Pay", dryRun: true }),
      })
      setMsg({ ok: res.ok, text: await res.text() })
    } catch {
      setMsg({ ok: false, text: "Sin conexión" })
    }
    setBusy(false)
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <div className={card}>
        <div className="flex items-start gap-3 mb-4">
          <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d1d1f] to-[#3a3a3c] flex items-center justify-center text-[18px]">💳</span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Pagos con Apple Pay</h2>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              Con la app Atajos del iPhone, cada pago con Wallet se registra solo: monto, comercio y la cuenta según la tarjeta. La categoría la elegimos por tus gastos anteriores en ese comercio.
            </p>
          </div>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {guide ? (
            <motion.div key="guide" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="px-3.5 py-2.5 rounded-xl bg-[#ff9500]/10 text-[12px] text-[#c93400] dark:text-[#ff9f0a]">
                Tu URL personal es como una llave: quien la tenga puede registrar gastos en tu Clarifi. No la compartas. Si se filtra, revócala abajo.
              </div>
              <ShortcutGuide url={url} step={guide.step} onStep={step => update({ ...guide, step })}
                footer={
                  <div className="flex gap-2">
                    <button type="button" onClick={test} disabled={busy}
                      className="flex-1 py-2.5 rounded-xl bg-[#007aff] text-white text-[13px] font-semibold disabled:opacity-40">
                      Probar conexión
                    </button>
                    <button type="button" onClick={() => { update(null); setMsg(null) }}
                      className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold">
                      Terminé
                    </button>
                  </div>
                } />
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-[#86868b]">
                {[["💳", "Pagas con Apple Pay"], ["⚡️", "Atajos avisa a Clarifi"], ["✅", "Gasto registrado"]].map(([e, t]) => (
                  <div key={t} className="rounded-xl bg-[#f5f5f7] dark:bg-white/[0.04] py-3 px-1"><p className="text-[20px]">{e}</p><p className="mt-1 leading-tight">{t}</p></div>
                ))}
              </div>
              <button type="button" onClick={create} disabled={busy}
                className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[14px] font-semibold disabled:opacity-40">
                {tokens?.length ? "Conectar otro iPhone" : "Conectar con Atajos"}
              </button>
              <p className="text-[11px] text-[#86868b] text-center">Te guiamos pantalla por pantalla. Toma unos 3 minutos; ábrelo desde el iPhone.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {msg && <p className={`mt-3 text-[13px] ${msg.ok ? "text-[#34c759]" : "text-[#ff3b30]"}`}>{msg.text}</p>}

        {!!tokens?.length && (
          <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-2">Conectados</p>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {tokens.map(t => (
                  <motion.li key={t.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 overflow-hidden">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{t.name} <span className="font-mono text-[11px] text-[#86868b]">{t.prefix}…</span></p>
                      <p className="text-[11px] text-[#86868b]">{ago(t.lastUsedAt)}</p>
                    </div>
                    <button type="button" onClick={() => revoke(t.id)} disabled={busy}
                      className="text-[12px] font-semibold text-[#ff3b30] hover:opacity-70 disabled:opacity-40">Revocar</button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </div>
    </MotionConfig>
  )
}
