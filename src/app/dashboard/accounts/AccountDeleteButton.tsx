"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"
import ConfirmDialog from "@/components/ConfirmDialog"

export default function AccountDeleteButton({ accountId, accountName, txCount }: {
  accountId: string
  accountName: string
  txCount: number
}) {
  const [confirm, setConfirm] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all flex-shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      {confirm && (
        <ConfirmDialog
          title={`Eliminar "${accountName}"`}
          message={txCount > 0
            ? `Esta cuenta tiene ${txCount} transacción${txCount !== 1 ? "es" : ""} asociada${txCount !== 1 ? "s" : ""} que también serán eliminadas. Esta acción no se puede deshacer.`
            : "¿Seguro que quieres eliminar esta cuenta? Esta acción no se puede deshacer."}
          onConfirm={() => {
            setConfirm(false)
            startTransition(async () => {
              await api.accounts.remove(accountId)
              router.refresh()
            })
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  )
}
