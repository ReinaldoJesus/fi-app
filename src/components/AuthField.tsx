"use client"
import { useState, type InputHTMLAttributes, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"

/** Icons for form fields (24×24, stroked). */
const ICONS = {
  user: <><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7l8.5 6 8.5-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path strokeLinecap="round" d="M8 11V7.5a4 4 0 018 0V11" /><circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" /></>,
  shield: <><path strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></>,
} as const
export type FieldIcon = keyof typeof ICONS

const EYE = <><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>
const EYE_OFF = <><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0112 6c6 0 9.5 6 9.5 6a17 17 0 01-3 3.6M6.4 7.6A16.6 16.6 0 002.5 12S6 18 12 18a9.6 9.6 0 004.3-1" /><path strokeLinecap="round" d="M9.9 9.9a3 3 0 004.2 4.2" /></>

/**
 * A text input with a leading icon that lights up while focused, a soft glow
 * ring, and (for passwords) a show/hide eye.
 */
export function IconInput({ icon, className = "", type = "text", ...props }: { icon: FieldIcon } & InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  const isPassword = type === "password"
  return (
    <div className="group relative">
      <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aeaeb2] dark:text-[#636366] transition-all duration-200 group-focus-within:text-[#007aff] group-focus-within:scale-110"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        {ICONS[icon]}
      </svg>
      <input {...props} type={isPassword && show ? "text" : type}
        className={`w-full pl-11 ${isPassword ? "pr-11" : "pr-4"} py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] text-[14px] transition-all duration-200 focus:outline-none focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#007aff]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.12)] ${className}`} />
      {isPassword && (
        <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
          <AnimatePresence mode="wait" initial={false}>
            <motion.svg key={show ? "off" : "on"} className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
              initial={{ opacity: 0, scale: 0.6, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.6, rotate: 20 }}
              transition={{ duration: 0.15 }}>
              {show ? EYE_OFF : EYE}
            </motion.svg>
          </AnimatePresence>
        </button>
      )}
    </div>
  )
}

/** Error / success box that drops in; errors give a little shake. */
export function FormAlert({ tone, children, className = "mb-4" }: { tone: "error" | "success"; children: ReactNode; className?: string }) {
  const error = tone === "error"
  return (
    <motion.div role={error ? "alert" : "status"}
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto", x: error ? [0, -7, 6, -4, 3, 0] : 0 }}
      transition={{ duration: 0.3, x: { duration: 0.45, delay: 0.1 } }}
      className={`${className} overflow-hidden px-4 py-3 rounded-xl text-[13px] border ${error
        ? "bg-[#ff3b30]/[0.08] border-[#ff3b30]/20 text-[#ff3b30]"
        : "bg-[#34c759]/[0.1] border-[#34c759]/25 text-[#248a3d] dark:text-[#30d158]"}`}>
      {children}
    </motion.div>
  )
}

/** Primary submit button with press feedback and a spinner while pending. */
export function SubmitButton({ pending, children, pendingLabel, className = "" }: { pending?: boolean; children: ReactNode; pendingLabel?: string; className?: string }) {
  return (
    <motion.button type="submit" disabled={pending} whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }}
      className={`w-full flex items-center justify-center gap-2 py-3 bg-[#1d1d1f] dark:bg-white hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)] disabled:opacity-50 text-white dark:text-[#1d1d1f] font-semibold rounded-xl text-[14px] transition-shadow ${className}`}>
      {pending && <span className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </motion.button>
  )
}
