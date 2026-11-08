/**
 * Smart defaults shared by the step-by-step signup and the dashboard forms:
 * the most common choices, so people pick instead of typing from scratch.
 */

export const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Cuenta corriente", icon: "🏦" },
  { value: "SAVINGS", label: "Cuenta vista / ahorro", icon: "🐷" },
  { value: "CREDIT_CARD", label: "Tarjeta de crédito", icon: "💳" },
  { value: "CASH", label: "Efectivo", icon: "💵" },
  { value: "INVESTMENT", label: "Inversiones", icon: "📈" },
] as const

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number]["value"]

export const ACCOUNT_COLORS = ["#34c759", "#007aff", "#bf5af2", "#ff3b30", "#e63946", "#ff9500"]

/** Name a new account from its type and bank: "Cuenta corriente Santander". */
export function accountName(type: string, bank?: string | null, country?: string | null) {
  // "Cuenta vista" is Chilean; elsewhere it is a savings account.
  const label = type === "SAVINGS" && country && country !== "CL"
    ? "Cuenta de ahorro"
    : ACCOUNT_TYPES.find(t => t.value === type)?.label.split(" / ")[0] ?? "Cuenta"
  return bank ? `${label} ${bank}` : label
}

export const POPULAR_SUBSCRIPTIONS = [
  { name: "Netflix", icon: "🎬", category: "streaming" },
  { name: "Spotify", icon: "🎵", category: "musica" },
  { name: "Disney+", icon: "🏰", category: "streaming" },
  { name: "YouTube Premium", icon: "▶️", category: "streaming" },
  { name: "iCloud", icon: "☁️", category: "cloud" },
  { name: "Gimnasio", icon: "💪", category: "fitness" },
  { name: "ChatGPT", icon: "🤖", category: "productividad" },
  { name: "Amazon Prime", icon: "📦", category: "streaming" },
] as const

export const GOAL_PRESETS = [
  { name: "Fondo de emergencia", icon: "🛟", color: "#34c759" },
  { name: "Vacaciones", icon: "✈️", color: "#007aff" },
  { name: "Auto", icon: "🚗", color: "#ff9500" },
  { name: "Casa propia", icon: "🏠", color: "#bf5af2" },
  { name: "Estudios", icon: "🎓", color: "#5856d6" },
  { name: "Tecnología", icon: "💻", color: "#ff3b30" },
] as const

/** Quick amounts for a savings goal (CLP). */
export const GOAL_AMOUNTS = [500_000, 1_000_000, 3_000_000, 5_000_000]

/** "In how long?" options for a goal deadline, in months. */
export const GOAL_DEADLINES = [
  { months: 6, label: "6 meses" },
  { months: 12, label: "1 año" },
  { months: 24, label: "2 años" },
]

/** YYYY-MM-DD, `months` from today. */
export function monthsFromNow(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString("en-CA")
}

/** Default expense categories people most often budget, with quick amounts (CLP). */
export const BUDGET_PRESETS = [
  { category: "Alimentación", icon: "🍔", amounts: [150_000, 250_000, 400_000] },
  { category: "Transporte", icon: "🚗", amounts: [40_000, 80_000, 150_000] },
  { category: "Entretenimiento", icon: "🎮", amounts: [30_000, 60_000, 100_000] },
] as const

export const CATEGORY_PRESETS = {
  EXPENSE: [
    { name: "Supermercado", icon: "🛒", color: "#34c759" },
    { name: "Restaurantes", icon: "🍽️", color: "#ff9500" },
    { name: "Mascotas", icon: "🐾", color: "#a2845e" },
    { name: "Servicios básicos", icon: "💡", color: "#ffcc00" },
    { name: "Suscripciones", icon: "📺", color: "#5856d6" },
    { name: "Regalos", icon: "🎁", color: "#ff2d55" },
    { name: "Viajes", icon: "✈️", color: "#007aff" },
    { name: "Hijos", icon: "🧸", color: "#ff9500" },
  ],
  INCOME: [
    { name: "Bonos", icon: "🎉", color: "#34c759" },
    { name: "Arriendos", icon: "🏘️", color: "#007aff" },
    { name: "Ventas", icon: "🏷️", color: "#ff9500" },
    { name: "Reembolsos", icon: "↩️", color: "#5ac8fa" },
  ],
} as const

export const fmtCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

/** Compact CLP for chips: $150 mil, $1,5 M. */
export function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)} mil`
  return fmtCLP(n)
}
