"use client"
import { createContext, useContext, useEffect, useState, ReactNode } from "react"

const Ctx = createContext<{ visible: boolean; toggle: () => void }>({ visible: true, toggle: () => {} })

export function BalanceVisibilityProvider({ children, initialHidden }: { children: ReactNode; initialHidden?: boolean }) {
  const [visible, setVisible] = useState(!(initialHidden ?? false))

  useEffect(() => {
    const stored = localStorage.getItem("balanceVisible")
    if (stored !== null) setVisible(stored !== "false")
  }, [])

  function toggle() {
    setVisible(v => {
      const next = !v
      localStorage.setItem("balanceVisible", String(next))
      return next
    })
  }

  return <Ctx.Provider value={{ visible, toggle }}>{children}</Ctx.Provider>
}

export function useBalanceVisibility() {
  return useContext(Ctx)
}
