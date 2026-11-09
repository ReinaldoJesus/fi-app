"use client"
import { useState, type ReactNode } from "react"
import { motion } from "motion/react"

/**
 * iPhone: Apple lets no app read other apps' notifications, but Shortcuts can run
 * when an e-mail or an SMS arrives. Banks send both for transfers, purchases and
 * automatic charges, so we forward them; Clarifi ignores promotions, codes and
 * reminders on its own.
 */

type Channel = "email" | "sms"

export function bankNoticePrompt(url: string, channel: Channel) {
  return channel === "email"
    ? `Crea una automatización personal de tipo "Correo" que se ejecute inmediatamente cuando me llegue un correo de mi banco (remitente: el correo de avisos de mi banco), y que ejecute un atajo nuevo que haga esto:

1. Acción "Obtener contenido de URL" con esta URL exacta:
${url}
2. Método POST y Cuerpo de la solicitud JSON con tres campos de texto:
   - "title": el asunto del correo (Entrada del atajo → Asunto)
   - "text": el contenido del correo (Entrada del atajo → Contenido)
   - "source": el texto fijo email

No agregues notificaciones, encabezados ni otras acciones.`
    : `Crea una automatización personal de tipo "Mensaje" que se ejecute inmediatamente cuando me llegue un SMS de mi banco, y que ejecute un atajo nuevo que haga esto:

1. Acción "Obtener contenido de URL" con esta URL exacta:
${url}
2. Método POST y Cuerpo de la solicitud JSON con dos campos de texto:
   - "text": el contenido del mensaje (Entrada del atajo)
   - "source": el texto fijo sms

No agregues notificaciones, encabezados ni otras acciones.`
}

function Copy({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }}
      onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ } }}
      className={`mt-2 w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#007aff] text-white text-left ${className}`}>
      <span className="flex-1 min-w-0 truncate font-mono text-[11px] opacity-90">{value.split("\n")[0]}</span>
      <span className="flex-shrink-0 text-[12px] font-semibold">{copied ? "¡Copiado!" : label}</span>
    </motion.button>
  )
}

export default function BankNoticesSetup({ url, ai, footer }: { url: string; ai: boolean; footer?: ReactNode }) {
  const [channel, setChannel] = useState<Channel>("email")
  const steps: { title: string; body: ReactNode; extra?: ReactNode }[] = channel === "email"
    ? [
        { title: "Que los correos del banco lleguen a Mail", body: <>La automatización usa la app <b>Mail</b> del iPhone. Si lees tu correo en la app de Gmail, agrega la cuenta en <b>Ajustes → Apps → Mail → Cuentas</b>.</> },
        { title: "Automatización “Correo”", body: <>En <b>Atajos → Automatización → +</b> elige <b>Correo</b>. En <b>Remitente</b> pon el correo con que tu banco te avisa de los movimientos. Marca <b>Ejecutar inmediatamente</b> → <b>Siguiente</b> → <b>Nuevo atajo en blanco</b>.</> },
        { title: "Enviar a Clarifi", body: <>Agrega <b>Obtener contenido de URL</b>, pega tu URL, y en la flecha <b>›</b> pon <b>Método POST</b> y <b>Cuerpo JSON</b>.</>, extra: <Copy value={url} label="Copiar URL" /> },
        { title: "Qué datos mandar", body: <>Tres campos de texto: <code>title</code> → <b>Entrada del atajo → Asunto</b>; <code>text</code> → <b>Entrada del atajo → Contenido</b>; <code>source</code> → escribe <code>email</code>. No agregues notificación: Clarifi ignora solo las promociones.</> },
      ]
    : [
        { title: "Automatización “Mensaje”", body: <>En <b>Atajos → Automatización → +</b> elige <b>Mensaje</b>. En <b>Remitente</b> elige el número o nombre con que te escribe tu banco. Marca <b>Ejecutar inmediatamente</b> → <b>Siguiente</b> → <b>Nuevo atajo en blanco</b>.</> },
        { title: "Enviar a Clarifi", body: <>Agrega <b>Obtener contenido de URL</b>, pega tu URL, y en la flecha <b>›</b> pon <b>Método POST</b> y <b>Cuerpo JSON</b>.</>, extra: <Copy value={url} label="Copiar URL" /> },
        { title: "Qué datos mandar", body: <>Dos campos de texto: <code>text</code> → <b>Entrada del atajo</b> (el mensaje); <code>source</code> → escribe <code>sms</code>.</> },
      ]

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#f5f5f7] dark:bg-white/[0.04] px-3.5 py-3 text-[12px] leading-relaxed text-[#3a3a3c] dark:text-[#d1d1d6]">
        El iPhone no deja que ninguna app lea los avisos de otras apps, pero sí puede reaccionar a los <b>correos</b> y <b>SMS</b> del banco.
        Clarifi registra <b>transferencias recibidas y enviadas, compras, sueldo y cobros automáticos</b>, e ignora promociones, claves y recordatorios.
        Si un pago llega dos veces (Apple Pay y el correo), se guarda una sola vez.
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[12px] font-semibold">
        {([["email", "✉️ Correos"], ["sms", "💬 SMS"]] as const).map(([c, label]) => (
          <button key={c} type="button" onClick={() => setChannel(c)}
            className={`relative py-2 rounded-lg ${channel === c ? "text-[#1d1d1f] dark:text-white" : "text-[#86868b]"}`}>
            {channel === c && <motion.span layoutId="bank-channel" className="absolute inset-0 rounded-lg bg-white dark:bg-[#3a3a3c] shadow-sm" />}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {ai && (
        <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-[#ff9500] via-[#ff2d55] to-[#5e5ce6]">
          <div className="rounded-[15px] bg-white dark:bg-[#1c1c1e] p-3.5">
            <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white">✨ Con Apple Intelligence</p>
            <p className="text-[12px] text-[#86868b] mt-0.5">Copia este prompt y pégalo en Atajos. Si no crea la automatización, sigue los pasos de abajo.</p>
            <Copy value={bankNoticePrompt(url, channel)} label="Copiar prompt" className="bg-gradient-to-r from-[#ff9500] via-[#ff2d55] to-[#5e5ce6]" />
          </div>
        </div>
      )}

      <ol className="space-y-3.5">
        {steps.map((s, i) => (
          <motion.li key={`${channel}-${s.title}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#34c759] text-white text-[12px] font-semibold flex items-center justify-center">{i + 1}</span>
            <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#3a3a3c] dark:text-[#d1d1d6] [&_code]:font-mono [&_code]:text-[11px] [&_code]:px-1 [&_code]:rounded [&_code]:bg-[#f5f5f7] dark:[&_code]:bg-[#2c2c2e]">
              <p className="font-semibold text-[#1d1d1f] dark:text-white">{s.title}</p>
              <p>{s.body}</p>
              {s.extra}
            </div>
          </motion.li>
        ))}
      </ol>
      {footer}
    </div>
  )
}
