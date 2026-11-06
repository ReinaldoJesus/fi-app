import type { ReactNode } from "react"

export type QuickActionKind = "income" | "expense" | "transfer" | "statement" | "budget" | "account"

const CONFIG: Record<QuickActionKind, { color: string; path: ReactNode }> = {
  income: { color: "#34c759", path: <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" /> },
  expense: { color: "#ff3b30", path: <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-6-6m6 6l6-6" /> },
  transfer: { color: "#007aff", path: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /> },
  statement: { color: "#af52de", path: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  budget: { color: "#ff9500", path: <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /> },
  account: { color: "#5ac8fa", path: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /> },
}

/** Visual content of a quick-action tile; wrap it in a <button> or <Link> with `quickActionCls`. */
export function QuickActionContent({ kind, label }: { kind: QuickActionKind; label: string }) {
  const { color, path } = CONFIG[kind]
  return (
    <>
      <span className="w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
        style={{ backgroundColor: color }}>
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>{path}</svg>
      </span>
      <span className="text-[11px] font-semibold text-white/85 leading-tight text-center">{label}</span>
    </>
  )
}

export const quickActionCls =
  "group flex flex-col items-center gap-2 py-3 rounded-2xl hover:bg-white/[0.06] transition-colors"
