const PATHS: Record<string, React.ReactNode> = {
  CHECKING: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-6 9 6M4 10h16M6 10v8m4-8v8m4-8v8m4-8v8M3 20h18" />,
  SAVINGS: <path strokeLinecap="round" strokeLinejoin="round" d="M19 9c1.1 0 2 .9 2 2v2h-2.2a6.97 6.97 0 01-1.8 2.5V19h-3v-2h-4v2H7v-3.5A7 7 0 1119 9zM8.5 6.5V5M15 11h.01" />,
  CREDIT_CARD: <><rect x="2" y="5" width="20" height="14" rx="2.5" /><path strokeLinecap="round" d="M2 10h20M6 15h4" /></>,
  CASH: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path strokeLinecap="round" d="M6 12h.01M18 12h.01" /></>,
  INVESTMENT: <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />,
}

export default function ProductIcon({ type, color, size = 40 }: { type: string; color: string; size?: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: `${color}1f`, color }}>
      <svg width={size * 0.48} height={size * 0.48} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {PATHS[type] ?? PATHS.CHECKING}
      </svg>
    </div>
  )
}
