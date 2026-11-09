"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import { api, type WhatsAppStatus } from "@/lib/api/client"
import { FAB_EVENT, fabHidden, setFabHidden } from "@/lib/whatsappFab"
import WhatsAppIcon from "@/components/WhatsAppIcon"

const card = "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-6"

/**
 * Connects the person's WhatsApp to the Clarifi bot: a 6-digit code goes out from
 * their own WhatsApp (pre-typed by the wa.me link), which proves the number is theirs.
 */
export default function WhatsAppSettings() {
  const router = useRouter()
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [code, setCode] = useState<{ code: string; url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [fabOn, setFabOn] = useState(true)

  const wasLinked = useRef<boolean | null>(null)
  const load = useCallback(async () => {
    const r = await api.me.whatsapp.status()
    if (!r.ok) return
    // Just linked from the phone: refresh the layout so the floating button opens the chat.
    if (wasLinked.current === false && r.data.linked) { setCode(null); router.refresh() }
    wasLinked.current = r.data.linked
    setStatus(r.data)
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setFabOn(!fabHidden())
    const sync = () => setFabOn(!fabHidden())
    window.addEventListener(FAB_EVENT, sync)
    load()
    return () => window.removeEventListener(FAB_EVENT, sync)
  }, [load])

  // While a code is waiting, notice the link as soon as they come back from WhatsApp.
  useEffect(() => {
    if (!code) return
    const t = setInterval(load, 4000)
    const onBack = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onBack)
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onBack) }
  }, [code, load])

  if (!status?.enabled || !status.botNumber) return null

  async function connect() {
    setBusy(true); setErr(null)
    const r = await api.me.whatsapp.link()
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setCode(r.data)
    window.location.href = r.data.url
  }

  async function disconnect() {
    setBusy(true)
    const r = await api.me.whatsapp.unlink()
    setBusy(false)
    if (r.ok) { await load(); router.refresh() }
  }

  return (
    <div id="whatsapp" className={card}>
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#25d366] text-white flex items-center justify-center"><WhatsAppIcon className="w-6 h-6" /></span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Anotar por WhatsApp</h2>
          <p className="text-[12px] text-[#86868b] mt-0.5">Escríbele al bot como te salga: <i>“gasté 5 lucas en el uber”</i>, <i>“15k super”</i>, <i>“me pagaron el sueldo”</i>. También: <b>borrar</b>, <b>saldo</b> y <b>mes</b>.</p>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {status.linked ? (
          <motion.div key="linked" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#25d366]/10">
              <span className="text-[18px]">✅</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">Conectado</p>
                <p className="text-[12px] text-[#86868b] font-mono truncate">{status.phone}</p>
              </div>
              <button type="button" onClick={disconnect} disabled={busy} className="text-[12px] font-semibold text-[#ff3b30] disabled:opacity-40">Desconectar</button>
            </div>
            <a href={`https://wa.me/${status.botNumber}`}
              className="block w-full py-3 rounded-xl bg-[#25d366] text-white text-center text-[14px] font-semibold">
              Abrir el chat con Clarifi
            </a>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <button type="button" onClick={connect} disabled={busy}
              className="w-full py-3 rounded-xl bg-[#25d366] text-white text-[14px] font-semibold disabled:opacity-40">
              {code ? "Abrir WhatsApp otra vez" : "Conectar WhatsApp"}
            </button>
            {code ? (
              <p className="text-[12px] text-[#86868b] text-center">
                Envía el mensaje que se abrió en WhatsApp (código <b className="font-mono text-[#1d1d1f] dark:text-white">{code.code}</b>, vale 10 minutos). Esta pantalla se actualiza sola.
              </p>
            ) : (
              <p className="text-[11px] text-[#86868b] text-center">Se abre WhatsApp con un mensaje listo: solo tócale enviar.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {err && <p className="mt-3 text-[13px] text-[#ff3b30]">{err}</p>}

      <label className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3 cursor-pointer">
        <span className="flex-1">
          <span className="block text-[14px] font-medium text-[#1d1d1f] dark:text-white">Botón flotante</span>
          <span className="block text-[12px] text-[#86868b]">El círculo verde abajo a la derecha, en este dispositivo.</span>
        </span>
        <input type="checkbox" checked={fabOn} onChange={e => setFabHidden(!e.target.checked)}
          className="w-5 h-5 accent-[#25d366]" />
      </label>
    </div>
  )
}
