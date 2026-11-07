"use client"
import { useSyncExternalStore } from "react"

const noopSubscribe = () => () => {}

/**
 * false during SSR and hydration, true once on the client. Replaces the
 * `useEffect(() => setMounted(true))` pattern without an extra render pass.
 */
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}
