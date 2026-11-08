"use client"
import { useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"

/**
 * Animated, one-tap-per-step walkthrough of the iPhone Shortcuts automation.
 * Each step shows a simplified phone screen with a pulsing finger on the exact
 * thing to tap, so nobody has to translate a paragraph of instructions.
 */

/* ─── Phone mock primitives ──────────────────────────────────────────────────── */

function Phone({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="mx-auto w-[248px] max-w-full rounded-[38px] bg-[#1d1d1f] p-[9px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
      <div className="relative h-[430px] rounded-[30px] bg-[#f2f2f7] overflow-hidden text-[#1d1d1f]">
        <div className="flex items-center justify-between px-6 pt-2.5 text-[10px] font-semibold">
          <span>9:41</span>
          <span className="absolute left-1/2 -translate-x-1/2 top-2 w-[74px] h-[20px] rounded-full bg-[#1d1d1f]" />
          <span>●●● ▮</span>
        </div>
        {title && <p className="px-4 pt-5 text-[22px] font-bold tracking-tight">{title}</p>}
        <div className="px-3 pt-3">{children}</div>
      </div>
    </div>
  )
}

/** Wraps the element to tap: pulsing ring + a finger that taps it. */
function Tap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <motion.span className="pointer-events-none absolute -inset-1 rounded-xl ring-2 ring-[#007aff]"
        animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.04, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
      <motion.span className="pointer-events-none absolute right-1 -bottom-3 text-[22px] drop-shadow"
        initial={{ y: 10, opacity: 0 }} animate={{ y: [10, 0, 2, 0], opacity: 1, scale: [1, 1, 0.85, 1] }}
        transition={{ duration: 1.2, delay: 0.3, repeat: Infinity, repeatDelay: 0.8 }}>
        👆
      </motion.span>
    </span>
  )
}

const Row = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl text-[12px] ${className}`}>{children}</div>
)
const Icon = ({ bg, children }: { bg: string; children: ReactNode }) => (
  <span className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] text-white flex-shrink-0" style={{ background: bg }}>{children}</span>
)
const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded-md bg-[#007aff]/15 text-[#007aff] font-medium">{children}</span>
)
const Action = ({ icon, bg, children }: { icon: string; bg: string; children: ReactNode }) => (
  <div className="bg-white rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-sm">
    <div className="flex items-start gap-2"><Icon bg={bg}>{icon}</Icon><div className="min-w-0 flex-1">{children}</div></div>
  </div>
)
const TabBar = ({ active }: { active: string }) => (
  <div className="absolute bottom-0 inset-x-0 flex justify-around bg-white/95 border-t border-black/10 pt-2 pb-4 text-[10px]">
    {["Atajos", "Automatización", "Galería"].map(t => (
      <span key={t} className={t === active ? "text-[#007aff] font-semibold" : "text-[#8e8e93]"}>{t}</span>
    ))}
  </div>
)

/* ─── Steps ──────────────────────────────────────────────────────────────────── */

type Step = { title: string; text: ReactNode; screen: ReactNode; copy?: boolean }

function steps(): Step[] {
  return [
    {
      title: "Abre la app Atajos",
      text: <>Viene instalada en el iPhone (ícono azul y rosado). Si no la tienes, bájala gratis del App Store. Necesitas iOS 17 o superior.</>,
      screen: (
        <div className="absolute inset-0 bg-gradient-to-b from-[#5e5ce6] to-[#bf5af2] p-6 pt-12 grid grid-cols-4 gap-4 content-start">
          {["📷", "🗺️", "💬", "🎵", "📅", "⚙️", "", "🛒"].map((e, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {i === 6 ? (
                <Tap><span className="w-11 h-11 rounded-xl flex items-center justify-center text-[20px] bg-gradient-to-br from-[#0a84ff] to-[#ff2d55]">⧉</span></Tap>
              ) : <span className="w-11 h-11 rounded-xl bg-white/25 flex items-center justify-center text-[20px]">{e}</span>}
              <span className="text-[9px] text-white">{i === 6 ? "Atajos" : ""}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Ve a Automatización",
      text: <>Abajo, en el centro, toca <b>Automatización</b>.</>,
      screen: (
        <>
          <div className="grid grid-cols-2 gap-2">{["Mis atajos", "Compartir", "Notas", "Música"].map(t => <div key={t} className="h-16 rounded-xl bg-[#5e5ce6]/80 p-2 text-[10px] text-white font-semibold">{t}</div>)}</div>
          <div className="absolute bottom-0 inset-x-0 flex justify-around bg-white/95 border-t border-black/10 pt-2 pb-4 text-[10px]">
            <span className="text-[#007aff] font-semibold">Atajos</span><Tap><span className="text-[#8e8e93] px-1">Automatización</span></Tap><span className="text-[#8e8e93]">Galería</span>
          </div>
        </>
      ),
    },
    {
      title: "Crea una nueva",
      text: <>Toca el <b>+</b> arriba a la derecha (o el botón <b>Nueva automatización</b> si es tu primera).</>,
      screen: (
        <>
          <div className="absolute top-9 right-4"><Tap><span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#007aff] text-[20px]">+</span></Tap></div>
          <div className="pt-10 text-center text-[12px] text-[#8e8e93]">Aún no tienes automatizaciones</div>
          <TabBar active="Automatización" />
        </>
      ),
    },
    {
      title: "Elige “Transacción”",
      text: <>Baja por la lista hasta <b>Transacción</b> (el ícono de Wallet). Se activa cada vez que pagas con una tarjeta de Wallet.</>,
      screen: (
        <div className="space-y-1.5">
          <Row><Icon bg="#ff9500">⏰</Icon>Hora del día</Row>
          <Row><Icon bg="#ff9500">⏰</Icon>Alarma</Row>
          <Row><Icon bg="#34c759">✉️</Icon>Correo</Row>
          <Row><Icon bg="#5856d6">📍</Icon>Llegar</Row>
          <Tap className="block"><Row><Icon bg="#1d1d1f">💳</Icon><b>Transacción</b></Row></Tap>
          <Row><Icon bg="#007aff">📶</Icon>Wi-Fi</Row>
        </div>
      ),
    },
    {
      title: "Tus tarjetas y “Ejecutar inmediatamente”",
      text: <>En <b>Tarjeta</b> elige tus tarjetas de Apple Pay. Más abajo marca <b>Ejecutar inmediatamente</b> (si no, te pedirá confirmar cada pago). Luego toca <b>Siguiente</b>.</>,
      screen: (
        <div className="space-y-2">
          <p className="text-[10px] text-[#8e8e93] uppercase px-1">Cuando toco</p>
          <Row className="justify-between"><span>Tarjeta</span><span className="text-[#007aff]">Santander, BCI</span></Row>
          <Row className="justify-between"><span>Categoría</span><span className="text-[#8e8e93]">Cualquiera</span></Row>
          <div className="bg-white rounded-xl text-[12px]">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/5"><span>Ejecutar tras confirmar</span><span className="w-4 h-4 rounded-full border border-[#c7c7cc]" /></div>
            <Tap className="block"><div className="flex items-center justify-between px-3 py-2.5"><b>Ejecutar inmediatamente</b><span className="w-4 h-4 rounded-full bg-[#007aff] text-white text-[9px] flex items-center justify-center">✓</span></div></Tap>
          </div>
          <div className="absolute top-9 right-4 text-[13px] font-semibold text-[#007aff]">Siguiente</div>
        </div>
      ),
    },
    {
      title: "“Nuevo atajo en blanco”",
      text: <>Te ofrecerá atajos de ejemplo: toca <b>Nuevo atajo en blanco</b>.</>,
      screen: (
        <div className="space-y-2 pt-4">
          <Tap className="block"><Row><Icon bg="#8e8e93">＋</Icon><b>Nuevo atajo en blanco</b></Row></Tap>
          <p className="text-[10px] text-[#8e8e93] uppercase px-1 pt-2">Para empezar</p>
          <Row><Icon bg="#ff2d55">🎵</Icon>Reproducir música</Row>
          <Row><Icon bg="#34c759">💬</Icon>Enviar mensaje</Row>
        </div>
      ),
    },
    {
      title: "Agrega “Obtener contenido de URL”",
      text: <>Toca <b>Agregar acción</b>, escribe <b>URL</b> en el buscador y elige <b>Obtener contenido de URL</b>.</>,
      screen: (
        <div className="space-y-2">
          <div className="bg-[#e3e3e8] rounded-lg px-3 py-1.5 text-[12px]">🔍 URL</div>
          <Row><Icon bg="#34c759">🔗</Icon>URL</Row>
          <Tap className="block"><Row><Icon bg="#34c759">⬇︎</Icon><b>Obtener contenido de URL</b></Row></Tap>
          <Row><Icon bg="#34c759">🔗</Icon>Abrir URL</Row>
        </div>
      ),
    },
    {
      title: "Pega tu URL personal",
      text: <>Toca la palabra azul <b>URL</b> y pega la dirección que copiaste aquí abajo. Esa URL ya incluye tu llave: no hay que configurar nada más de seguridad.</>,
      copy: true,
      screen: (
        <div className="pt-4">
          <Action icon="⬇︎" bg="#34c759">Obtener contenido de <Tap><Chip>URL</Chip></Tap></Action>
        </div>
      ),
    },
    {
      title: "Método POST y cuerpo JSON",
      text: <>Toca la flechita <b>›</b> de la acción para ver más opciones. En <b>Método</b> elige <b>POST</b> y en <b>Cuerpo de la solicitud</b> elige <b>JSON</b>.</>,
      screen: (
        <div className="pt-4">
          <Action icon="⬇︎" bg="#34c759">
            <p>Obtener contenido de <Chip>clarifi…/shortcuts/…</Chip> <span className="text-[#8e8e93]">⌄</span></p>
            <div className="mt-2 divide-y divide-black/5">
              <div className="flex justify-between py-1.5"><span>Método</span><Tap><Chip>POST</Chip></Tap></div>
              <div className="flex justify-between py-1.5"><span>Encabezados</span><span className="text-[#8e8e93]">—</span></div>
              <div className="flex justify-between py-1.5"><span>Cuerpo de la solicitud</span><Chip>JSON</Chip></div>
            </div>
          </Action>
        </div>
      ),
    },
    {
      title: "Agrega el monto",
      text: <>Toca <b>Agregar campo nuevo → Texto</b>. En la clave escribe <b>amount</b>. Toca el valor: sobre el teclado aparece <b>Entrada del atajo</b>; tócala, después toca la etiqueta azul que quedó y elige <b>Importe</b> (o Monto).</>,
      screen: (
        <div className="pt-4">
          <Action icon="⬇︎" bg="#34c759">
            <p className="text-[#8e8e93] text-[10px] uppercase">Cuerpo · JSON</p>
            <div className="mt-1.5 flex items-center gap-1.5"><span className="font-mono">amount</span><span className="text-[#8e8e93]">→</span><Tap><Chip>Entrada del atajo · Importe</Chip></Tap></div>
            <p className="mt-2 text-[#007aff]">＋ Agregar campo nuevo</p>
          </Action>
          <div className="absolute bottom-0 inset-x-0 bg-[#d1d3d9] p-2 space-y-1.5">
            <div className="flex gap-1.5"><span className="px-2 py-1 rounded-md bg-white text-[10px] font-semibold text-[#007aff]">Entrada del atajo</span><span className="px-2 py-1 rounded-md bg-white text-[10px]">Fecha actual</span></div>
            <div className="h-20 rounded-md bg-[#bcc0c7]" />
          </div>
        </div>
      ),
    },
    {
      title: "Agrega el comercio y la tarjeta",
      text: <>Igual que antes: campo <b>merchant</b> con <b>Entrada del atajo → Comerciante</b>, y campo <b>card</b> con <b>Entrada del atajo → Tarjeta o pase</b>. La tarjeta sirve para elegir la cuenta correcta.</>,
      screen: (
        <div className="pt-4">
          <Action icon="⬇︎" bg="#34c759">
            <p className="text-[#8e8e93] text-[10px] uppercase">Cuerpo · JSON</p>
            <div className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-1.5"><span className="font-mono">amount</span><span className="text-[#8e8e93]">→</span><Chip>Importe</Chip></div>
              <div className="flex items-center gap-1.5"><span className="font-mono">merchant</span><span className="text-[#8e8e93]">→</span><Tap><Chip>Comerciante</Chip></Tap></div>
              <div className="flex items-center gap-1.5"><span className="font-mono">card</span><span className="text-[#8e8e93]">→</span><Chip>Tarjeta o pase</Chip></div>
            </div>
          </Action>
        </div>
      ),
    },
    {
      title: "Que te avise al registrar",
      text: <>Agrega la acción <b>Mostrar notificación</b>. Borra el texto “Hola mundo”, toca ahí y elige la variable <b>Contenido de URL</b>. Toca <b>OK</b> o <b>Listo</b> arriba: ¡terminaste!</>,
      screen: (
        <div className="pt-4 space-y-2">
          <Action icon="⬇︎" bg="#34c759">Obtener contenido de <Chip>clarifi…</Chip></Action>
          <Action icon="🔔" bg="#ff3b30">Mostrar notificación <Tap><Chip>Contenido de URL</Chip></Tap></Action>
          <div className="absolute top-9 right-4 text-[13px] font-semibold text-[#007aff]">OK</div>
        </div>
      ),
    },
    {
      title: "Listo: paga y mira",
      text: <>La próxima vez que pagues con Apple Pay te llegará este aviso y el gasto quedará en Clarifi. Puedes probar la conexión ahora con el botón de abajo (no guarda nada).</>,
      screen: (
        <div className="absolute inset-0 bg-gradient-to-b from-[#1c1c1e] to-[#3a3a3c] pt-16 px-3">
          <p className="text-center text-white text-[44px] font-light leading-none">9:41</p>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-6 rounded-2xl bg-white/85 backdrop-blur px-3 py-2.5 text-[11px]">
            <p className="font-semibold">ATAJOS · ahora</p>
            <p>✓ Registrado: $4.990 en Starbucks · Alimentación · Cuenta corriente Santander</p>
          </motion.div>
        </div>
      ),
    },
  ]
}

/* ─── Guide ──────────────────────────────────────────────────────────────────── */

export default function ShortcutGuide({ url, step, onStep, footer }: {
  url: string
  step: number
  onStep: (n: number) => void
  footer?: ReactNode
}) {
  const all = steps()
  const s = all[Math.min(step, all.length - 1)]
  const [dir, setDir] = useState(1)
  const [copied, setCopied] = useState(false)
  const go = (d: number) => { setDir(d); onStep(Math.max(0, Math.min(all.length - 1, step + d))) }
  const progress = Math.round(((step + 1) / all.length) * 100)

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-[12px] mb-1.5">
          <span className="font-semibold text-[#1d1d1f] dark:text-white">Paso {step + 1} de {all.length}</span>
          <span className="text-[#86868b] tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#007aff] to-[#34c759]" initial={false} animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} custom={dir}
            initial={{ x: dir * 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -40, opacity: 0 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
            onDragEnd={(_, i) => { if (i.offset.x < -60) go(1); else if (i.offset.x > 60) go(-1) }}
            className="space-y-4">
            <Phone>{s.screen}</Phone>
            <div>
              <p className="text-[16px] font-semibold text-[#1d1d1f] dark:text-white">{s.title}</p>
              <p className="text-[13px] leading-relaxed text-[#3a3a3c] dark:text-[#d1d1d6] mt-1">{s.text}</p>
            </div>
            {s.copy && (
              <motion.button type="button" onClick={copy} whileTap={{ scale: 0.97 }}
                className="w-full flex items-center gap-2 px-3.5 py-3 rounded-xl bg-[#007aff] text-white text-left">
                <span className="flex-1 min-w-0 truncate font-mono text-[12px] opacity-90">{url}</span>
                <span className="flex-shrink-0 text-[13px] font-semibold">{copied ? "¡Copiada!" : "Copiar URL"}</span>
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => go(-1)} disabled={step === 0}
          className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold disabled:opacity-30">
          Atrás
        </button>
        {step < all.length - 1 ? (
          <button type="button" onClick={() => go(1)}
            className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold">
            Siguiente
          </button>
        ) : <div className="flex-1">{footer}</div>}
      </div>
      <a href="shortcuts://" className="block text-center text-[12px] font-medium text-[#007aff]">Abrir la app Atajos ↗</a>
    </div>
  )
}

