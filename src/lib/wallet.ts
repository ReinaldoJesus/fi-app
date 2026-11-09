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

/* ─── Any bank notice: purchases, transfers in/out, charges; skip promotions ── */

const PROMO = /(promo\b|promoci[oó]n|descuento|dcto|oferta|aprovecha|beneficio|cuotas sin inter[eé]s|pre-?\s?aprobad|simula|cotiza|\bgana\b|participa|sorteo|cyber|black friday|te invitamos|\d+\s?% (de )?(dcto|descuento|cashback)|hasta \d+\s?%)/i
const SECURITY = /(clave|c[oó]digo|token|verificaci[oó]n|\botp\b|inicio de sesi[oó]n|nuevo dispositivo|contrase[nñ]a)/i
const REMINDER = /(vence|vencimiento|recuerda|recordatorio|pr[oó]ximo (pago|cobro|cargo)|por vencer|fecha l[ií]mite|estado de cuenta (disponible|est[aá])|ya est[aá] disponible)/i
const INCOME_RE = /(recibiste|has recibido|te transfiri[oó]|te han transferido|te enviaron|te envi[oó]|transferencia recibida|recepci[oó]n de (una )?transferencia|\babono\b|abonamos|se abon[oó]|dep[oó]sito|depositamos|remuneraci[oó]n|\bsueldo\b|reembolso|devoluci[oó]n|you received|money received)/i
const EXPENSE_RE = /(compra|compraste|pagaste|\bpago\b|\bcargo\b|cobro|cobramos|d[eé]bito autom[aá]tico|\bpac\b|\bpat\b|transferiste|enviaste|transferencia (a |realizada|enviada|de fondos a)|\bgiro\b|retiro|avance|you paid|purchase|charged)/i
const SALARY = /(remuneraci[oó]n|\bsueldo\b|n[oó]mina|salario)/i

// A person's name after "de"/"a", up to "por", "$", a number or punctuation.
const FROM_RE = /\b(?:de|desde)\s+(\p{L}[\p{L}.' ]{2,60}?)(?=\s+(?:por|a tu|en tu|con|el|al|hacia|desde tu)\b|\s*\$|\s*[.,;\n(]|\s+\d|$)/u
const TO_RE = /\ba\s+(\p{L}[\p{L}.' ]{2,60}?)(?=\s+(?:por|a tu|en tu|con|el|al|desde)\b|\s*\$|\s*[.,;\n(]|\s+\d|$)/u
const SENDER_RE = /(\p{L}[\p{L}' ]{2,60}?)\s+te\s+(?:transfiri|envi)/u

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())

export type ClassifiedNotice =
  | { kind: "ignore"; reason: string }
  | { kind: "movement"; type: "INCOME" | "EXPENSE"; amount?: string; description?: string; card?: string; salary: boolean }

/**
 * Reads any bank notice (app notification, e-mail or SMS) and says whether it is
 * a movement (and which way) or something to skip: promotions, security codes,
 * reminders and balance notices never become movements.
 *
 *   "Recibiste una transferencia de JUAN PEREZ por $50.000"   → INCOME  "Transferencia de Juan Perez"
 *   "Se realizó un cargo por $9.990 por PAT NETFLIX"          → EXPENSE "Netflix"
 *   "Compra por $24.980 en PORTAL LA REINA con tu débito"     → EXPENSE "PORTAL LA REINA"
 *   "Aprovecha 30% de descuento en tu próxima compra"         → ignore (promoción)
 */
export function classifyNotification(title = "", text = ""): ClassifiedNotice {
  const ti = title.replace(/\s+/g, " ").trim()
  const body = text.replace(/\s+/g, " ").trim()
  // E-mails carry long footers (often with promotions): decide on the top part.
  const head = `${ti}. ${body.slice(0, 500)}`

  if (PROMO.test(ti)) return { kind: "ignore", reason: "promoción" }
  const inc = head.search(INCOME_RE), exp = head.search(EXPENSE_RE)
  if (inc < 0 && exp < 0) {
    if (PROMO.test(head)) return { kind: "ignore", reason: "promoción" }
    if (SECURITY.test(head)) return { kind: "ignore", reason: "aviso de seguridad" }
    return { kind: "ignore", reason: "no parece un movimiento" }
  }
  const at = Math.min(...[inc, exp].filter(i => i >= 0))
  const promoAt = head.search(PROMO)
  if (promoAt >= 0 && promoAt < at) return { kind: "ignore", reason: "promoción" }
  if (REMINDER.test(head)) return { kind: "ignore", reason: "recordatorio" }
  if (SECURITY.test(head) && !AMOUNT_RE.test(head)) return { kind: "ignore", reason: "aviso de seguridad" }

  const type: "INCOME" | "EXPENSE" = inc >= 0 && (exp < 0 || inc <= exp) ? "INCOME" : "EXPENSE"
  const after = head.slice(at)
  const amount = after.match(AMOUNT_RE)?.[0] ?? head.match(AMOUNT_RE)?.[0]
  if (!amount) return { kind: "ignore", reason: "sin monto" }

  const salary = type === "INCOME" && SALARY.test(head)
  const name = (re: RegExp) => after.match(re)?.[1]?.trim().replace(/[.,;:]+$/, "")
  let description: string | undefined
  if (salary) {
    description = "Sueldo"
  } else if (type === "INCOME") {
    const who = name(FROM_RE) ?? body.match(SENDER_RE)?.[1]?.trim()
    description = who ? `Transferencia de ${titleCase(who)}` : /transfer/i.test(head) ? "Transferencia recibida" : undefined
  } else if (/transferiste|enviaste|transferencia (a |realizada|enviada|de fondos a)/i.test(after)) {
    const to = name(TO_RE)
    description = to ? `Transferencia a ${titleCase(to)}` : "Transferencia enviada"
  } else {
    const pat = after.match(/\b(?:PAT|PAC)\s+([\p{L}\d][\p{L}\d .*&-]{1,40}?)(?=\s*[.,;\n]|\s+(?:con|por|el)\b|$)/iu)?.[1]
    const por = after.match(/\d\s+(?:por|de)\s+(?!tu\b|su\b|un\b|una\b)([\p{L}\d][\p{L}\d .*&-]{1,40}?)(?=\s*[.,;\n]|\s+(?:con|en|el)\b|$)/iu)?.[1]
    description = pat ? titleCase(pat) : parseNotification(ti, body.slice(0, 500)).merchant ?? (por ? por.trim() : undefined)
  }
  const card = parseNotification(ti, body.slice(0, 500)).card
  return { kind: "movement", type, amount, description, card, salary }
}
