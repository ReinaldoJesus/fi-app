"use client"
import { useSyncExternalStore } from "react"
import Link from "next/link"

type Step = {
  id: string
  label: string
  description: string
  done: boolean
  href: string
}

const KEY = "onboarding-dismissed"
const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const readDismissed = () => { try { return localStorage.getItem(KEY) === "1" } catch { return false } }

/**
 * "Primeros pasos": progress starts above zero (signing up already counts),
 * which makes finishing the setup feel within reach.
 */
export default function OnboardingBanner({ steps, percent }: { steps: Step[]; percent: number }) {
  // Hidden during SSR too, so it never flashes before the dismissal is read.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true)
  if (dismissed) return null

  const doneCount = steps.filter(s => s.done).length
  const nextStep = steps.find(s => !s.done)

  function dismiss() {
    try { localStorage.setItem(KEY, "1") } catch { /* storage unavailable */ }
    listeners.forEach(l => l())
  }

  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-5 mb-2 anim-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
            Tu Clarifi está {percent}% listo · {doneCount} de {steps.length}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            {nextStep ? `Siguiente: ${nextStep.label} — ${nextStep.description}` : "¡Todo listo!"}
          </p>
        </div>
        <button onClick={dismiss} title="Ocultar"
          className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors p-1 -mr-1 -mt-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden mb-4">
        <div className="h-full bg-[#34c759] rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((step, i) => (
          <Link key={step.id} href={step.href}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
              step.done
                ? "bg-[#34c759]/[0.08] border-[#34c759]/20"
                : step === nextStep
                  ? "bg-[#007aff]/[0.06] border-[#007aff]/25"
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
