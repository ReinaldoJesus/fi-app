// Shared visual tokens (Tailwind class strings) for the bank-style UI.

export const card =
  "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none"

export const sectionTitle = "text-[15px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight"

export const eyebrow = "text-[10px] font-semibold text-[#86868b] uppercase tracking-[0.08em]"

export const linkAction = "text-[13px] text-[#007aff] font-medium hover:opacity-70 transition-opacity"

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CHECKING: "Cuenta corriente",
  SAVINGS: "Cuenta de ahorro",
  CREDIT_CARD: "Tarjeta de crédito",
  CASH: "Efectivo",
  INVESTMENT: "Inversiones",
}
