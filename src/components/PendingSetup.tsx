"use client"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"

export const SETUP_DRAFT_KEY = "clarifi-signup-draft"

/** Stored by the signup wizard. `handoff` is set only right before a Google/GitHub redirect. */
export type SetupDraft = { form?: unknown; handoff?: Parameters<typeof api.me.setup>[0] }

/**
 * After a Google/GitHub signup the browser comes back to the dashboard: apply
 * what the person built in the wizard (once — the API answers 409 if the user
 * already has accounts) and clear the draft. Renders nothing.
 */
export default function PendingSetup() {
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    let draft: SetupDraft | null = null
    try { draft = JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY) ?? "null") } catch { /* storage unavailable */ }
    if (!draft?.handoff) return
    api.me.setup(draft.handoff).then(r => {
      // Applied, or already configured / invalid: either way the draft is done.
      if (r.ok || r.error !== "No hay conexión con el servidor") {
        try { localStorage.removeItem(SETUP_DRAFT_KEY) } catch { /* ignore */ }
      }
      if (r.ok) router.refresh()
    })
  }, [router])

  return null
}
