"use client"
import { useState } from "react"
import Link from "next/link"

type Step = {
  label: string
  description: string
  done: boolean
  href: string
}

export default function OnboardingBanner({ steps }: { steps: Step[] }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)
  const nextStep = steps.find(s => !s.done)

  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-2">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
            Primeros pasos · {doneCount} de {steps.length}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            {nextStep ? `Siguiente: ${nextStep.label}` : "¡Todo listo!"}
          </p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors p-1 -mr-1 -mt-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden mb-4">
        <div className="h-full bg-[#007aff] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, i) => (
          <Link key={i} href={step.href}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
              step.done
                ? "bg-[#34c759]/[0.08] border-[#34c759]/20"
                : "bg-[#f5f5f7] dark:bg-white/[0.05] border-transparent hover:border-black/[0.07] dark:hover:border-white/[0.07]"
            }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              step.done ? "bg-[#34c759]" : "bg-[#e5e5ea] dark:bg-white/[0.15]"
            }`}>
              {step.done ? (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="text-[9px] font-bold text-[#86868b]">{i + 1}</span>
              )}
            </div>
            <span className={`text-[11px] font-medium leading-tight ${step.done ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"}`}>
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
