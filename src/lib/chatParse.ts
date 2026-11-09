/**
 * Understands what people type to the WhatsApp bot, the way they say it in Chile and
 * around: "gasté 5 lucas en el uber", "15k super", "me pagaron el sueldo 1.200.000",
 * "+50000 transferencia de Juan". Also a few commands (ayuda, borrar, saldo, mes).
 */

export type ChatIntent =
  | { kind: "link"; code: string }
  | { kind: "help" }
  | { kind: "undo" }
  | { kind: "balance" }
  | { kind: "month" }
  | { kind: "movement"; type: "EXPENSE" | "INCOME"; amount: number | string; description?: string; salary: boolean }
  | { kind: "unknown" }

const LINK_RE = /c[oó]digo\D{0,12}(\d{6})\b/i
const HELP_RE = /^(hola|holi|buenas|buen d[ií]a|ayuda|help|men[uú]|inicio|\?+|qu[eé] puedes hacer\??)$/i
const UNDO_RE = /^(borra(r)?|deshacer|deshaz|elimina(r)?|anula(r)?|undo)( (el |lo )?([uú]ltimo|eso))?$/i
const BALANCE_RE = /^(saldo|saldos|mis cuentas|cuentas|cu[aá]nto tengo\??)$/i
const MONTH_RE = /^(mes|resumen|gastos?( del mes)?|cu[aá]nto (llevo|he gastado|gast[eé])( (este|el) mes)?\??)$/i

// A number, optionally with "$", followed by an optional multiplier word.
const AMOUNT_RE = /(?:^|[\s(+$])\$?\s?(\d[\d.,]*)\s*(lucas?|k\b|mil\b|palos?|millones?|mill[oó]n|mm\b)?/i
const MULTIPLIER: Record<string, number> = { luca: 1e3, lucas: 1e3, k: 1e3, mil: 1e3, palo: 1e6, palos: 1e6, millon: 1e6, "millón": 1e6, millones: 1e6, mm: 1e6 }

const INCOME_RE = /(^\+|me pagaron|me pag[oó]|me deposit|me transfiri|me lleg[oó]|me abonaron|recib[ií]|ingres[oó]|ingreso|gan[eé]|vend[ií]|cobr[eé]|sueldo|salario|remuneraci[oó]n|reembolso|devoluci[oó]n)/i
const SALARY_RE = /(sueldo|salario|remuneraci[oó]n|n[oó]mina)/i
// Verbs that say what happened but are not the place or the reason.
const VERBS = new Set(["gaste", "gasté", "pague", "pagué", "compre", "compré", "pagaron", "pagó", "depositaron", "depositó", "transfirió",
  "transfirieron", "llegó", "abonaron", "recibi", "recibí", "ingresó", "gane", "gané", "vendi", "vendí", "cobre", "cobré"])
// Little words that only matter between other words.
const FILLER = new Set([...VERBS, "me", "en", "el", "la", "los", "las", "un", "una", "por", "para", "de", "del", "al", "y", "con", "hoy", "ayer",
  "fue", "son", "eran", "$", "+", "-", "pesos", "clp"])

/** "1,5" with a multiplier is one and a half; a bare number keeps its thousands dots for the account's currency. */
function amountFrom(num: string, mult: string | undefined): number | string {
  if (!mult) return num
  const factor = MULTIPLIER[mult.toLowerCase()] ?? 1
  const decimal = /^\d+[.,]\d{1,2}$/.test(num) ? Number(num.replace(",", ".")) : Number(num.replace(/[.,]/g, ""))
  return Math.round(decimal * factor)
}

export function parseChatMessage(raw: string): ChatIntent {
  const text = raw.trim().replace(/\s+/g, " ")
  if (!text) return { kind: "unknown" }

  const link = text.match(LINK_RE)
  if (link) return { kind: "link", code: link[1] }
  const bare = text.replace(/[¡!.]+$/g, "").trim()
  if (HELP_RE.test(bare)) return { kind: "help" }
  if (UNDO_RE.test(bare)) return { kind: "undo" }
  if (BALANCE_RE.test(bare)) return { kind: "balance" }
  if (MONTH_RE.test(bare)) return { kind: "month" }

  const m = text.match(AMOUNT_RE)
  if (!m) return { kind: "unknown" }
  const amount = amountFrom(m[1], m[2])

  const words = (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length))
    .replace(/[,.:;!¡?¿]/g, " ").split(" ").filter(Boolean)
  // Fillers only at the edges: "gasté … en el uber" → "uber", but "transferencia de Juan" stays whole.
  const isFiller = (w: string) => FILLER.has(w.toLowerCase())
  while (words.length && isFiller(words[0])) words.shift()
  while (words.length && isFiller(words[words.length - 1])) words.pop()
  // "gasté 5 lucas en el uber" leaves "gasté" stranded before the amount: drop verbs anywhere.
  const rest = words.filter(w => !VERBS.has(w.toLowerCase())).join(" ")
  const description = rest ? rest[0].toUpperCase() + rest.slice(1) : undefined
  const income = INCOME_RE.test(text)
  return { kind: "movement", type: income ? "INCOME" : "EXPENSE", amount, description, salary: income && SALARY_RE.test(text) }
}
