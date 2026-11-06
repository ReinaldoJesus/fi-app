"use client"

export default function ConfirmDialog({ title, message, confirmLabel = "Eliminar", onConfirm, onCancel }: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-black/[0.08] dark:border-white/[0.08] anim-pop-in">
        <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white mb-2">{title}</h3>
        <p className="text-[13px] text-[#86868b] leading-relaxed mb-5">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80 transition-opacity">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#ff3b30] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
