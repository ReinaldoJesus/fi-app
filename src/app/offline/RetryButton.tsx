"use client"

export default function RetryButton() {
  return (
    <button onClick={() => location.reload()}
      className="mt-6 px-5 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[14px] font-semibold hover:opacity-90">
      Reintentar
    </button>
  )
}
