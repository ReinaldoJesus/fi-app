"use client"
import { useEffect, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { api, type ApiToken } from "@/lib/api/client"

const card = "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-6"
const code = "flex-1 min-w-0 truncate font-mono text-[12px] px-3 py-2 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white"

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className={code}>{value}</span>
        <button type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }}
          className="flex-shrink-0 px-3 py-2 rounded-lg text-[12px] font-semibold bg-[#007aff]/10 text-[#007aff] hover:bg-[#007aff]/15 min-w-[72px]">
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  )
}

const ago = (iso: string | null) => {
  if (!iso) return "Nunca usado"
  const d = new Date(iso)
  return `Último uso: ${d.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
}

/**
 * "Pagos con Apple Pay": creates a personal token and walks the person through
 * the iPhone Shortcuts automation that sends each Wallet payment to Clarifi.
 */
export default function ShortcutsSettings() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window is client-only
    setOrigin(window.location.origin)
    api.me.tokens.list().then(r => setTokens(r.ok ? r.data : []))
  }, [])

  const endpoint = `${origin}/api/v1/shortcuts/transaction?format=text`

  async function create() {
    setBusy(true); setMsg(null)
    const r = await api.me.tokens.create({ name: "Atajos del iPhone" })
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    const { token, ...row } = r.data
    setFresh(token)
    setTokens(t => [row, ...(t ?? [])])
  }

  async function revoke(id: string) {
    setBusy(true)
    const r = await api.me.tokens.revoke(id)
    setBusy(false)
    if (r.ok) setTokens(t => (t ?? []).filter(x => x.id !== id))
  }

  /** Sends a fake payment with dryRun: checks the token and shows how it would be recorded. */
  async function test() {
    if (!fresh) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${fresh}`, "content-type": "application/json" },
        body: JSON.stringify({ amount: "$4.990", merchant: "Prueba Apple Pay", card: "", dryRun: true }),
      })
      setMsg({ ok: res.ok, text: await res.text() })
    } catch {
      setMsg({ ok: false, text: "Sin conexión" })
    }
    setBusy(false)
  }

  const steps: { title: string; body: React.ReactNode }[] = [
    { title: "Crea la automatización", body: <>En el iPhone abre <b>Atajos</b> → pestaña <b>Automatización</b> → <b>+</b> → <b>Transacción</b>. Elige tus tarjetas de Wallet, marca <b>Ejecutar inmediatamente</b> y toca <b>Siguiente</b> → <b>Nuevo atajo en blanco</b>.</> },
    { title: "Envía el pago a Clarifi", body: <>Agrega la acción <b>Obtener contenido de URL</b> y pega la URL de abajo. Toca la flecha ›: <b>Método</b> POST, <b>Encabezados</b>: clave <code>Authorization</code> y como valor tu token (completo, con <code>Bearer</code>). <b>Cuerpo de la solicitud</b>: JSON.</> },
    { title: "Elige qué datos mandar", body: <>Agrega tres campos de texto: <code>amount</code> → variable <b>Entrada del atajo</b> → <i>Importe</i>; <code>merchant</code> → <i>Comerciante</i>; <code>card</code> → <i>Tarjeta o pase</i>.</> },
    { title: "Que te avise", body: <>Agrega <b>Mostrar notificación</b> con <b>Contenido de la URL</b>. Al pagar verás: “✓ Registrado: $4.990 en Starbucks · Alimentación · Cuenta corriente”.</> },
  ]

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <div className={card}>
        <div className="flex items-start gap-3 mb-4">
          <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d1d1f] to-[#3a3a3c] flex items-center justify-center text-[18px]">💳</span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Pagos con Apple Pay</h2>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              Con la app Atajos del iPhone, cada pago con Wallet se registra solo: el monto, el comercio y la cuenta según la tarjeta. La categoría la elegimos por tus gastos anteriores en ese comercio.
            </p>
          </div>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {fresh ? (
            <motion.div key="setup" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="px-3.5 py-2.5 rounded-xl bg-[#ff9500]/10 text-[12px] text-[#c93400] dark:text-[#ff9f0a]">
                Copia tu token ahora: por seguridad no lo volveremos a mostrar. Quien lo tenga puede registrar movimientos en tu Clarifi.
              </div>
              <CopyField label="URL" value={endpoint} />
              <CopyField label="Authorization" value={`Bearer ${fresh}`} />

              <ol className="space-y-3 pt-1">
                {steps.map((s, i) => (
                  <motion.li key={s.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}
                    className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#34c759] text-white text-[12px] font-semibold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 text-[13px] leading-relaxed text-[#3a3a3c] dark:text-[#d1d1d6] [&_code]:font-mono [&_code]:text-[12px] [&_code]:px-1 [&_code]:rounded [&_code]:bg-[#f5f5f7] dark:[&_code]:bg-[#2c2c2e]">
                      <p className="font-semibold text-[#1d1d1f] dark:text-white">{s.title}</p>
                      <p>{s.body}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>

              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={test} disabled={busy}
                  className="px-4 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold disabled:opacity-40">
                  Probar conexión
                </button>
                <button type="button" onClick={() => { setFresh(null); setMsg(null) }}
                  className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold">
                  Listo, ya lo copié
                </button>
              </div>
              <p className="text-[11px] text-[#86868b]">La prueba no guarda nada: solo te muestra cómo quedaría un pago de $4.990.</p>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button type="button" onClick={create} disabled={busy}
                className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[14px] font-semibold disabled:opacity-40">
                {tokens?.length ? "Conectar otro iPhone" : "Conectar con Atajos"}
              </button>
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
