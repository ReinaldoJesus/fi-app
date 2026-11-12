"use client"
import { AnimatePresence, motion } from "motion/react"
import { useBalanceVisibility } from "@/contexts/BalanceVisibility"
import { CountUp } from "./motion"

/**
 * An amount that can be hidden (••••). Showing / hiding blurs between the two;
 * `countUp` makes the big ones count up from zero when the screen opens.
 */
export default function PrivateAmount({ value, className, countUp = false }: { value: string; className?: string; countUp?: boolean }) {
  const { visible } = useBalanceVisibility()
  return (
    <AnimatePresence mode="wait" initial={false}>
      {visible ? (
        <motion.span key="shown" className={className}
          initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.15 }}>
          {countUp ? <CountUp value={value} /> : value}
        </motion.span>
      ) : (
        <motion.span key="hidden" className={`${className ?? ""} tracking-widest select-none`}
          initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.15 }}>
          ••••
        </motion.span>
      )}
    </AnimatePresence>
  )
}
