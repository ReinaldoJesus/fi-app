"use client"
import { createContext, useCallback, useContext, useSyncExternalStore, ReactNode } from "react"

const Ctx = createContext<{ visible: boolean; toggle: () => void }>({ visible: true, toggle: () => {} })

const KEY = "balanceVisible"
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

function readStored(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

/** Show/hide amounts; the choice lives in localStorage, the server default comes from the profile. */
export function BalanceVisibilityProvider({ children, initialHidden }: { children: ReactNode; initialHidden?: boolean }) {
  const stored = useSyncExternalStore(subscribe, readStored, () => null)
  const visible = stored === null ? !(initialHidden ?? false) : stored !== "false"

  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY, String(!visible)) } catch { /* storage unavailable */ }
    listeners.forEach(l => l())
  }, [visible])

  return <Ctx.Provider value={{ visible, toggle }}>{children}</Ctx.Provider>
}

export function useBalanceVisibility() {
  return useContext(Ctx)
}
