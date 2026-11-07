"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"

const MAX_SIDE = 1600

/** Resizes a camera photo to ≤1600px JPEG (~150–300 KB) before upload. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.8),
  )
}

/** Receipt photo for a movement: attach from camera/gallery, view, replace or remove. */
export default function ReceiptField({ transactionId, hasReceipt, onChange }: {
  transactionId: string
  hasReceipt: boolean
  onChange: (hasReceipt: boolean) => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [version, setVersion] = useState(() => Date.now())

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const r = await api.transactions.uploadReceipt(transactionId, await compress(file))
      if (!r.ok) throw new Error(r.error)
      setVersion(Date.now())
      onChange(true)
      router.refresh()
    } catch (err) {
      setError((err as Error).message || "No se pudo subir la foto")
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError("")
    const r = await api.transactions.removeReceipt(transactionId)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    onChange(false)
    router.refresh()
  }

  const url = api.transactions.receiptUrl(transactionId, version)
  return (
    <div>
      <p className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Boleta</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {hasReceipt ? (
        <div className="flex items-center gap-3">
          <a href={url} target="_blank" rel="noopener" className="block w-16 h-16 rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.1] flex-shrink-0 bg-[#f5f5f7] dark:bg-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not optimizable */}
            <img src={url} alt="Boleta" className="w-full h-full object-cover" />
          </a>
          <div className="flex flex-col items-start gap-1">
            <a href={url} target="_blank" rel="noopener" className="text-[13px] text-[#007aff] font-medium hover:opacity-70">Ver boleta</a>
            <div className="flex gap-3">
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="text-[12px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-40">Cambiar</button>
              <button type="button" disabled={busy} onClick={remove} className="text-[12px] text-[#ff3b30] hover:opacity-70 disabled:opacity-40">Quitar</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-black/[0.15] dark:border-white/[0.15] text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:border-black/30 dark:hover:border-white/30 transition-colors disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {busy ? "Subiendo…" : "Adjuntar foto de la boleta"}
        </button>
      )}
      {error && <p className="text-[12px] text-[#ff3b30] mt-1.5">{error}</p>}
    </div>
  )
}
