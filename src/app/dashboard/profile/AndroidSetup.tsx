"use client"
import { useState, type ReactNode } from "react"
import { motion } from "motion/react"

/**
 * Android has no Shortcuts "Transaction" trigger and Google Wallet does not share
 * payments with other apps. What it does is show a notification for each payment,
 * so an automation app (MacroDroid, free) forwards that notification to Clarifi,
 * which reads the amount, merchant and card from its text.
 */

/** MacroDroid magic text for the notification's title and text. */
export const ANDROID_BODY = `{"title":"[not_title]","text":"[notification]"}`
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid"

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }}
      onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ } }}
      className="mt-2 w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#34a853] text-white text-left">
      <span className="flex-1 min-w-0 truncate font-mono text-[11px] opacity-90">{value}</span>
      <span className="flex-shrink-0 text-[12px] font-semibold">{copied ? "¡Copiado!" : label}</span>
    </motion.button>
  )
}

export default function AndroidSetup({ url, footer }: { url: string; footer?: ReactNode }) {
  const steps: { title: string; body: ReactNode; extra?: ReactNode }[] = [
    {
      title: "Instala MacroDroid (gratis)",
      body: <>Es una app de automatizaciones para Android. Clarifi la usa para leer el aviso de cada pago.</>,
      extra: <a href={PLAY_URL} target="_blank" rel="noreferrer" className="mt-2 inline-block px-3.5 py-2 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[12px] font-semibold">Abrir en Play Store ↗</a>,
    },
    {
      title: "Disparador: el aviso del pago",
      body: <>Toca <b>Agregar macro</b> → en <b>Disparadores</b> toca <b>+</b> → <b>Notificación recibida</b>. Elige <b>Google Wallet</b> y <b>la app de tu banco</b> (así también llegan transferencias, sueldo y cobros automáticos). Cuando pida <b>Acceso a notificaciones</b>, toca <b>Permitir</b>.</>,
    },
    {
      title: "Acción: enviar a Clarifi",
      body: <>En <b>Acciones</b> toca <b>+</b> → <b>Solicitud HTTP</b>. Método <b>POST</b> y en URL pega tu dirección personal:</>,
      extra: <CopyButton value={url} label="Copiar URL" />,
    },
    {
      title: "Qué datos mandar",
      body: <>En <b>Cuerpo</b> elige el tipo <b>application/json</b> y pega esto. <code>[not_title]</code> y <code>[notification]</code> son el título y el texto del aviso; si tu versión los nombra distinto, elígelos con el botón <b>…</b> de texto mágico.</>,
      extra: <CopyButton value={ANDROID_BODY} label="Copiar cuerpo" />,
    },
    {
      title: "Guarda y deja que funcione",
      body: <>Toca <b>✓</b> y ponle de nombre <b>Clarifi</b>. Si Android te lo pide, quita la <b>optimización de batería</b> a MacroDroid para que funcione con la pantalla apagada.</>,
    },
  ]
  return (
    <div className="space-y-4">
      <ol className="space-y-3.5">
        {steps.map((s, i) => (
          <motion.li key={s.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#34a853] text-white text-[12px] font-semibold flex items-center justify-center">{i + 1}</span>
            <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#3a3a3c] dark:text-[#d1d1d6] [&_code]:font-mono [&_code]:text-[11px] [&_code]:px-1 [&_code]:rounded [&_code]:bg-[#f5f5f7] dark:[&_code]:bg-[#2c2c2e]">
              <p className="font-semibold text-[#1d1d1f] dark:text-white">{s.title}</p>
              <p>{s.body}</p>
              {s.extra}
            </div>
          </motion.li>
        ))}
      </ol>
      <p className="text-[11px] text-[#86868b]">
        Clarifi lee cada aviso: registra compras, transferencias recibidas y enviadas, sueldo y cobros automáticos, e ignora promociones, claves y recordatorios. Si el mismo movimiento llega dos veces, se guarda una sola.
      </p>
      {footer}
    </div>
  )
}
