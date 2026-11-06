export default function BrandMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  const box = inverted
    ? "bg-white text-[#1d1d1f]"
    : "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
  return (
    <div
      className={`rounded-[10px] flex items-center justify-center flex-shrink-0 ${box}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
        <path strokeLinecap="round" d="M17 6a8 8 0 1 0 0 12" />
      </svg>
    </div>
  )
}
