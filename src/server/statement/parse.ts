import * as XLSX from "xlsx"
import { todayParts } from "../dates"

/**
 * Pure bank-statement parsing (no database): finds the header row, maps the
 * columns and normalizes dates, amounts and movement types.
 */
export const MAX_STATEMENT_BYTES = 4 * 1024 * 1024
export const STATEMENT_EXTENSIONS = [".csv", ".txt", ".xls", ".xlsx"]
const MAX_ROWS = 2000
const HEADER_SCAN_ROWS = 40

export type PreviewRow = {
  line: number
  date: string
  description: string
  type: "INCOME" | "EXPENSE"
  amount: number
  categoryId: string | null
  /** A movement with the same date, amount and type already exists in the account. */
  duplicate: boolean
}

type Columns = {
  date: number
  description: number | null
  amount: number | null
  debit: number | null
  credit: number | null
  type: number | null
  category: number | null
}

export const norm = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

const isHeader = {
  date: (h: string) => /^fecha\b|^date\b|^dia\b/.test(h),
  description: (h: string) => /descripcion|detalle|glosa|concepto|comercio|movimiento|description|referencia/.test(h),
  debit: (h: string) => /cargo|debito|giro|egreso|retiro|debit/.test(h),
  credit: (h: string) => /abono|credito|deposito|ingreso|credit/.test(h),
  amount: (h: string) => /^monto|importe|^valor|amount|^total$/.test(h),
  type: (h: string) => /^tipo\b|^type\b/.test(h),
  category: (h: string) => /categoria|category/.test(h),
}

/** Finds the header row (bank exports often start with logos, RUT, account number…). */
function detectColumns(rows: unknown[][]): { headerRow: number; cols: Columns } | null {
  for (let r = 0; r < Math.min(rows.length, HEADER_SCAN_ROWS); r++) {
    const cells = rows[r].map(norm)
    const find = (test: (h: string) => boolean, exclude: number[] = []) => {
      const i = cells.findIndex((h, idx) => h && !exclude.includes(idx) && test(h))
      return i === -1 ? null : i
    }
    const date = find(isHeader.date)
    if (date === null) continue
    const debit = find(isHeader.debit, [date])
    const credit = find(isHeader.credit, [date, ...(debit !== null ? [debit] : [])])
    const amount = find(isHeader.amount, [date, ...(debit !== null ? [debit] : []), ...(credit !== null ? [credit] : [])])
    if (amount === null && debit === null && credit === null) continue
    const taken = [date, debit, credit, amount].filter((x): x is number => x !== null)
    const description = find(isHeader.description, taken)
    const type = find(isHeader.type, [...taken, ...(description !== null ? [description] : [])])
    const category = find(isHeader.category, taken)
    return { headerRow: r, cols: { date, description, amount, debit, credit, type, category } }
  }
  return null
}

/** Parses "$ 1.234.567", "-1.234", "1.234,50", "(1.234)", or a number. */
export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  let s = String(v ?? "").trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (s.includes("-")) negative = true
  s = s.replace(/[^0-9.,]/g, "")
  if (!s) return null
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",")
  if (lastDot !== -1 && lastComma !== -1) {
    // Both separators: the last one is the decimal mark.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else if (lastComma !== -1) {
    // Only commas: decimal if exactly 1–2 digits follow the last one ("1234,5"), else thousands.
    s = /,\d{1,2}$/.test(s) && s.split(",").length === 2 ? s.replace(",", ".") : s.replace(/,/g, "")
  } else if (lastDot !== -1) {
    // Only dots: Chilean thousands ("1.234.567") unless it looks like a decimal ("12.5").
    s = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Excel serial, Date, "dd/mm/yyyy", "dd-mm-yy", "yyyy-mm-dd" or "dd/mm" (current year) → "YYYY-MM-DD". */
export function parseDate(v: unknown): string | null {
  const today = todayParts()
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null
  }
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  const s = String(v ?? "").trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return valid(y, +m[2], +m[1])
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/)
  if (m) {
    // No year (common in card statements): assume the most recent past occurrence.
    const month = +m[2], day = +m[1]
    const year = month > today.month || (month === today.month && day > today.day) ? today.year - 1 : today.year
    return valid(year, month, day)
  }
  return null
}

function valid(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null
}

const SKIP_DESCRIPTIONS = /^(saldo|total|subtotal|resumen)\b/

function readWorkbook(name: string, bytes: Buffer) {
  const ext = name.toLowerCase().slice(name.lastIndexOf("."))
  if (ext === ".csv" || ext === ".txt") {
    // Bank CSVs are often Latin-1; fall back when the bytes aren't valid UTF-8.
    let text: string
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch { text = new TextDecoder("latin1").decode(bytes) }
    return XLSX.read(text.replace(/^﻿/, ""), { type: "string", raw: true, dense: true })
  }
  return XLSX.read(bytes, { type: "buffer", cellDates: false, dense: true })
}


export class StatementError extends Error {}

export function parseStatement(file: { name: string; bytes: Buffer }) {
  let wb: XLSX.WorkBook
  try {
    wb = readWorkbook(file.name, file.bytes)
  } catch {
    throw new StatementError("No pudimos leer el archivo. Sube la cartola en Excel (.xls, .xlsx) o CSV.")
  }

  let found: { rows: unknown[][]; headerRow: number; cols: Columns; sheet: string } | null = null
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: "", blankrows: false })
    const det = detectColumns(rows)
    if (det) { found = { rows, sheet, ...det }; break }
  }
  if (!found) {
    throw new StatementError("No encontramos las columnas de la cartola. Debe tener una columna Fecha y otra de Monto, o de Cargos y Abonos.")
  }

  const { rows, headerRow, cols } = found
  const out: Omit<PreviewRow, "categoryId" | "duplicate">[] = []
  const categoryNames: (string | null)[] = []
  /** Raw signed value for rows typed by sign (single amount column, no type column). */
  const signed: (number | null)[] = []
  let skipped = 0

  for (let i = headerRow + 1; i < rows.length && out.length < MAX_ROWS; i++) {
    const row = rows[i]
    const date = parseDate(row[cols.date])
    const description = cols.description !== null ? String(row[cols.description] ?? "").trim().slice(0, 200) : ""
    if (!date || SKIP_DESCRIPTIONS.test(norm(description))) { skipped++; continue }

    let type: "INCOME" | "EXPENSE" = "EXPENSE"
    let amount: number | null
    let raw: number | null = null
    if (cols.debit !== null || cols.credit !== null) {
      const debit = cols.debit !== null ? Math.abs(parseAmount(row[cols.debit]) ?? 0) : 0
      const credit = cols.credit !== null ? Math.abs(parseAmount(row[cols.credit]) ?? 0) : 0
      type = credit > 0 && debit === 0 ? "INCOME" : "EXPENSE"
      amount = type === "INCOME" ? credit : debit
    } else {
      raw = parseAmount(row[cols.amount!])
      amount = raw === null ? null : Math.abs(raw)
      const typeText = cols.type !== null ? norm(row[cols.type]) : ""
      if (typeText) {
        type = /ingreso|abono|income|credito|deposito/.test(typeText) ? "INCOME" : "EXPENSE"
        raw = null // typed by its column, not by sign
      }
    }
    if (!amount) { skipped++; continue }
    out.push({ line: i + 1, date, description, type, amount: Math.round(amount * 100) / 100 })
    signed.push(raw)
    categoryNames.push(cols.category !== null ? norm(row[cols.category]) || null : null)
  }

  // Single signed amount column: if any value is negative, negatives are charges and
  // positives deposits. If none is, it's a card statement: everything is an expense.
  if (signed.some(v => v !== null && v < 0)) {
    out.forEach((r, k) => { if (signed[k] !== null) r.type = signed[k]! < 0 ? "EXPENSE" : "INCOME" })
  }

  if (!out.length) throw new StatementError("La cartola no tiene movimientos con fecha y monto.")

  return { sheet: found.sheet, rows: out, categoryNames, skipped, truncated: out.length >= MAX_ROWS }
}
