"use client"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { api } from "@/lib/api/client"
import { FAB_EVENT, fabHidden } from "@/lib/whatsappFab"
import WhatsAppIcon from "./WhatsAppIcon"

/**
 * Floating button to talk to the Clarifi bot on WhatsApp. Linked: opens the chat.
 * Not linked yet: opens WhatsApp with the link code already typed, so one tap on
 * "send" connects it. Sits above the mobile tab bar.
 */
export default function WhatsAppFab({ botNumber, linked }: { botNumber: string; linked: boolean }) {
  const [hidden, setHidden] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sync = () => setHidden(fabHidden())
    sync()
    window.addEventListener(FAB_EVENT, sync)
    return () => window.removeEventListener(FAB_EVENT, sync)
  }, [])

  async function open() {
    if (linked) { window.location.href = `https://wa.me/${botNumber}`; return }
    setBusy(true)
    const r = await api.me.whatsapp.link()
    setBusy(false)
    // Same tab: iOS blocks window.open after an await, and wa.me hands off to the app anyway.
    window.location.href = r.ok ? r.data.url : `https://wa.me/${botNumber}`
  }

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          type="button" onClick={open} disabled={busy}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.92 }} transition={{ type: "spring", stiffness: 420, damping: 26 }}
          aria-label={linked ? "Escribirle a Clarifi por WhatsApp" : "Conectar WhatsApp con Clarifi"}
          title={linked ? "Anotar por WhatsApp" : "Conectar WhatsApp"}
          className="fixed z-40 right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:right-6 lg:bottom-6 w-14 h-14 rounded-full bg-[#25d366] text-white shadow-[0_6px_20px_rgba(37,211,102,0.45)] flex items-center justify-center disabled:opacity-60 print:hidden">
          <WhatsAppIcon className="w-7 h-7" />
          {!linked && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#ff3b30] border-2 border-white dark:border-black" />}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
