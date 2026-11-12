"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { MotionConfig, animate, motion, useInView, useReducedMotion, type Variants } from "motion/react"

/**
 * Small motion vocabulary for the app, usable from server components:
 * entrances that cascade, bars that fill, amounts that count up. Everything
 * honours the phone's "Reduce motion" setting (MotionConfig reducedMotion="user").
 */

const EASE_OUT = [0.16, 1, 0.3, 1] as const
export const spring = { type: "spring", stiffness: 380, damping: 34 } as const

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={spring}>{children}</MotionConfig>
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }
const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

/** Children marked <StaggerItem> appear one after another. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={container} initial="hidden" animate="show">{children}</motion.div>
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={item}>{children}</motion.div>
}

/** Fades and rises in once it scrolls into view (or right away if already visible). */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }} transition={{ duration: 0.5, ease: EASE_OUT, delay }}>
      {children}
    </motion.div>
  )
}

/** A progress bar that fills from zero when it comes into view. */
export function ProgressBar({ pct, color, className = "h-full rounded-full", delay = 0.1 }: { pct: number; color?: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const width = `${Math.max(0, Math.min(100, pct))}%`
  return (
    <motion.div ref={ref} className={className} style={{ backgroundColor: color }}
      initial={{ width: 0 }} animate={{ width: inView ? width : 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 22, delay }} />
  )
}

// "$1.234.567", "−$12.990", "US$12,50", "Usado $3.000": prefix, number (es-CL), suffix.
const NUMBER_RE = /^(.*?)(\d{1,3}(?:\.\d{3})*|\d+)(,\d+)?(.*)$/

/**
 * Counts up to the amount when shown (from 0 the first time, from the previous
 * amount afterwards, e.g. when a filter changes); ends on the exact original text.
 */
export function CountUp({ value, className, duration = 1.6, delay = 0.25 }: { value: string; className?: string; duration?: number; delay?: number }) {
  const reduce = useReducedMotion()
  const m = value.match(NUMBER_RE)
  const decimals = m?.[3] ? m[3].length - 1 : 0
  const target = m ? Number(m[2].replace(/\./g, "")) + (decimals ? Number(`0.${m[3]!.slice(1)}`) : 0) : 0
  const format = (n: number) => m ? `${m[1]}${n.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[4]}` : value
  const counts = !!m && target > 0
  // Server and first client render agree on the starting frame; the effect animates to the real value.
  // null = done: show the original text exactly.
  const [text, setText] = useState<string | null>(() => (counts ? format(0) : null))
  // The number on screen right now, so a new value continues from there.
  const shown = useRef(0)

  useEffect(() => {
    const from = shown.current
    if (!counts || from === target) return
    const first = from === 0
    // "Reduce motion": same path, zero duration, so it lands on the value at once.
    const controls = animate(from, target, {
      duration: reduce ? 0 : first ? duration : duration * 0.5,
      delay: reduce || !first ? 0 : delay,
      ease: EASE_OUT,
      onUpdate: v => { shown.current = v; setText(format(decimals ? v : Math.round(v))) },
      onComplete: () => { shown.current = target; setText(null) },
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the value matters
  }, [value, reduce])

  return <span className={className}>{counts ? text ?? value : value}</span>
}
