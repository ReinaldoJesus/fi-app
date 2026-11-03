"use client"
import { useBalanceVisibility } from "@/contexts/BalanceVisibility"

export default function PrivateAmount({ value, className }: { value: string; className?: string }) {
  const { visible } = useBalanceVisibility()
  if (visible) return <span className={className}>{value}</span>
  return <span className={`${className ?? ""} tracking-widest select-none`}>••••</span>
}
