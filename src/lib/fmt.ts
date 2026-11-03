export const CURRENCIES = [
  { code: "CLP", label: "CLP – Peso chileno" },
  { code: "USD", label: "USD – Dólar estadounidense" },
  { code: "EUR", label: "EUR – Euro" },
  { code: "ARS", label: "ARS – Peso argentino" },
  { code: "BRL", label: "BRL – Real brasileño" },
  { code: "COP", label: "COP – Peso colombiano" },
  { code: "MXN", label: "MXN – Peso mexicano" },
  { code: "PEN", label: "PEN – Sol peruano" },
  { code: "UYU", label: "UYU – Peso uruguayo" },
]

const ZERO_DECIMALS = new Set(["CLP", "COP", "UYU"])

export function fmtCurrency(amount: number, currency = "CLP"): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: ZERO_DECIMALS.has(currency) ? 0 : 2,
  }).format(amount)
}
