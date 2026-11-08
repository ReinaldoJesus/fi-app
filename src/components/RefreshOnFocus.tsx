"use client"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * Movements can arrive while the app sits in the background (Apple Pay via
 * Shortcuts, Android notifications). When the person comes back to Clarifi we
 * re-fetch the server data so they see them without pulling to refresh.
 */
export default function RefreshOnFocus({ minIntervalMs = 15_000 }: { minIntervalMs?: number }) {
  const router = useRouter()
  const last = useRef(0)
  useEffect(() => {
    last.current = Date.now()
    const onShow = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return
      if (Date.now() - last.current < minIntervalMs) return
      last.current = Date.now()
      router.refresh()
    }
    document.addEventListener("visibilitychange", onShow)
    window.addEventListener("focus", onShow)
    window.addEventListener("pageshow", onShow)
    return () => {
      document.removeEventListener("visibilitychange", onShow)
      window.removeEventListener("focus", onShow)
      window.removeEventListener("pageshow", onShow)
    }
  }, [router, minIntervalMs])
  return null
}
