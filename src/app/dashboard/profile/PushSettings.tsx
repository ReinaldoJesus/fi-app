"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"

type Status =
  | { kind: "loading" }
  | { kind: "unsupported"; ios: boolean }
  | { kind: "not-configured" }
  | { kind: "denied" }
  | { kind: "ready"; subscribed: boolean; publicKey: string }

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/")
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** "Notificaciones en este dispositivo": subscribe/unsubscribe this browser to Web Push. */
export default function PushSettings() {
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      let next: Status
      if (!supported) {
        next = { kind: "unsupported", ios: /iPhone|iPad|iPod/.test(navigator.userAgent) }
      } else {
        const r = await api.push.status()
        if (!r.ok || !r.data.configured || !r.data.publicKey) next = { kind: "not-configured" }
        else if (Notification.permission === "denied") next = { kind: "denied" }
        else {
          const sub = await currentSubscription()
          const known = !!sub && r.data.devices.some(d => d.endpoint === sub.endpoint)
          next = { kind: "ready", subscribed: known, publicKey: r.data.publicKey }
        }
      }
      if (!cancelled) setStatus(next)
    })()
    return () => { cancelled = true }
  }, [])

  async function enable(publicKey: string) {
    setBusy(true)
    setMessage(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? { kind: "denied" } : status)
        return
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const r = await api.push.subscribe({ endpoint: json.endpoint, keys: json.keys })
      if (!r.ok) throw new Error(r.error)
      setStatus({ kind: "ready", subscribed: true, publicKey })
      setMessage({ ok: true, text: "Notificaciones activadas en este dispositivo." })
    } catch (err) {
      setMessage({ ok: false, text: `No se pudieron activar: ${(err as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  async function disable(publicKey: string) {
    setBusy(true)
    setMessage(null)
    try {
      const sub = await currentSubscription()
      if (sub) {
        await api.push.unsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      setStatus({ kind: "ready", subscribed: false, publicKey })
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMessage(null)
    const r = await api.push.test()
    setBusy(false)
    setMessage(r.ok
      ? { ok: true, text: r.data.sent ? "Te enviamos una notificación de prueba." : "No llegó a ningún dispositivo; desactiva y vuelve a activar." }
      : { ok: false, text: r.error })
  }

  const hint = "text-[12px] text-[#86868b] mt-0.5"
  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white">Notificaciones en este dispositivo</p>
          {status.kind === "loading" && <p className={hint}>Revisando…</p>}
          {status.kind === "unsupported" && (
            <p className={hint}>
              {status.ios
                ? "En iPhone, primero instala Clarifi: en Safari toca Compartir → \"Agregar a inicio\", y ábrela desde el icono."
                : "Este navegador no permite notificaciones push."}
            </p>
          )}
          {status.kind === "not-configured" && <p className={hint}>Aún no están habilitadas en el servidor.</p>}
          {status.kind === "denied" && <p className={hint}>Las bloqueaste para Clarifi. Actívalas en los ajustes del navegador o del teléfono.</p>}
          {status.kind === "ready" && (
            <p className={hint}>Avisos de cobros de mañana y presupuestos por agotarse, cada día a las 9:00.</p>
          )}
        </div>
        {status.kind === "ready" && (
          <button
            type="button"
            role="switch"
            aria-checked={status.subscribed}
            disabled={busy}
            onClick={() => (status.subscribed ? disable(status.publicKey) : enable(status.publicKey))}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${status.subscribed ? "bg-[#34c759]" : "bg-[#e5e5ea] dark:bg-[#3a3a3c]"} ${busy ? "opacity-50" : ""}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${status.subscribed ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        )}
      </div>
      {status.kind === "ready" && status.subscribed && (
        <button type="button" onClick={test} disabled={busy} className="mt-2 text-[12px] text-[#007aff] font-medium hover:opacity-70 disabled:opacity-40">
          Enviar notificación de prueba
        </button>
      )}
      {message && <p className={`mt-1.5 text-[12px] ${message.ok ? "text-[#34c759]" : "text-[#ff3b30]"}`}>{message.text}</p>}
    </div>
  )
}
