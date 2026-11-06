/**
 * A calendar date ("2026-11-06") is stored at 12:00 UTC so it stays on the same
 * day in any American/European timezone (00:00 UTC showed as the previous day in Chile).
 */
export function parseDateInput(value: string | null | undefined, fallback: Date = new Date()): Date {
  if (!value) return fallback
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00.000Z`)
  return new Date(value)
}

export const APP_TIMEZONE = "America/Santiago"

/** Today's year/month/day in the app timezone. */
export function todayParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { year: get("year"), month: get("month"), day: get("day") }
}
