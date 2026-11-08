/** Pure helpers for Wallet / Apple Pay payments sent by iPhone Shortcuts. */

const ZERO_DECIMALS = new Set(["CLP", "COP", "UYU", "PYG", "JPY", "KRW"])

/** "$12.990" → 12990, "US$4,50" → 4.5, "1.234,56 €" → 1234.56, "1,234.56" → 1234.56. */
export function parseLooseAmount(raw: string | number, currency = "CLP"): number {
  if (typeof raw === "number") return Math.abs(raw)
  const s = raw.replace(/[^\d.,]/g, "")
  if (!/\d/.test(s)) return NaN
  const last = Math.max(s.lastIndexOf(","), s.lastIndexOf("."))
  const tail = last >= 0 ? s.slice(last + 1) : ""
  // A separator followed by 1–2 digits is the decimal point; any other separator groups thousands.
  const value = last >= 0 && tail.length > 0 && tail.length <= 2
    ? Number(`${s.slice(0, last).replace(/[.,]/g, "")}.${tail}`)
    : Number(s.replace(/[.,]/g, ""))
  return ZERO_DECIMALS.has(currency) ? Math.round(value) : Math.round(value * 100) / 100
}

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

type Acc = { id: string; name: string; bank: string | null; type: string; currency: string }

/** Best account for a Wallet card name such as "Santander Visa" or "Tarjeta BCI Débito". */
export function matchAccount(card: string | undefined, accounts: Acc[]): Acc | null {
  if (!card || !accounts.length) return null
  const c = norm(card)
  const wantsCredit = /credit|credito/.test(c)
  const wantsDebit = /debit|debito/.test(c)
  let best: Acc | null = null, bestScore = 0
  for (const a of accounts) {
    let score = 0
    const name = norm(a.name), bank = a.bank ? norm(a.bank) : ""
    if (name && (c.includes(name) || name.includes(c))) score += 3
    if (bank && c.includes(bank)) score += 2
    if (score && wantsCredit && a.type === "CREDIT_CARD") score += 1
    if (score && wantsDebit && a.type !== "CREDIT_CARD") score += 1
    if (score > bestScore) { best = a; bestScore = score }
  }
  if (best) return best
  // No bank or name in the card ("Tarjeta de débito ****1234"): if only one account
  // has that kind of card, it must be that one.
  const ofKind = wantsCredit ? accounts.filter(a => a.type === "CREDIT_CARD")
    : wantsDebit ? accounts.filter(a => a.type === "CHECKING" || a.type === "SAVINGS")
    : []
  return ofKind.length === 1 ? ofKind[0] : null
}

/* ─── Android: payment notifications (Google Wallet or the bank's app) ──────── */

const AMOUNT_RE = /(?:US\$|R\$|MX\$|S\/|CLP|COP|ARS|MXN|PEN|UYU|BRL|USD|EUR|\$|€)\s?-?\d[\d.,]*|\d[\d.,]*\s?(?:€|USD|EUR|CLP)\b/i
const APP_TITLE = /wallet|google|banco|bank|santander|bci|estado|pago|compra|transacci|notific/i

/**
 * Pulls amount, merchant and card out of a payment notification, e.g.
 *   "Starbucks" / "$12.990 con Visa ••1234"                                  (Google Wallet)
 *   "Santander" / "Compra por $24.980 en PORTAL LA REINA con tu tarjeta de débito ****1234"
 *   "Google Wallet" / "You paid $4.50 at Starbucks with Visa ••1234"
 */
export function parseNotification(title = "", text = "") {
  const t = text.replace(/\s+/g, " ").trim(), ti = title.trim()
  const amount = `${ti} ${t}`.match(AMOUNT_RE)?.[0]
  const card = t.match(/\b(?:con|with)\s+(?:tu\s+|su\s+|your\s+)?(.+?)\s*(?:\.\s|\.$|$)/i)?.[1]
    ?? t.match(/[•*]{2,}\s?\d{4}/)?.[0]
  let merchant = t.match(/\b(?:en|at)\s+(.+?)(?=\s+(?:con|with|por|for)\b|[.,;]\s|[.,;]$|$)/i)?.[1]
  if (merchant && AMOUNT_RE.test(merchant)) merchant = undefined
  // Google Wallet puts the merchant in the title.
  if (!merchant && ti && !AMOUNT_RE.test(ti) && !APP_TITLE.test(ti)) merchant = ti
  return { amount, merchant: merchant?.trim(), card: card?.trim() }
}
