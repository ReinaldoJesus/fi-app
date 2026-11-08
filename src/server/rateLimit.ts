import "server-only"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { ApiError } from "./errors"

/**
 * Fixed-window rate limiting backed by Postgres, so the limit holds across
 * Vercel's serverless instances. Fails open: if the table is unreachable the
 * request is allowed (and logged) rather than locking everyone out.
 */
export type RateRule = { limit: number; windowSec: number }

export const RULES = {
  loginEmail: { limit: 8, windowSec: 15 * 60 },
  loginIp: { limit: 40, windowSec: 15 * 60 },
  signupIp: { limit: 10, windowSec: 60 * 60 },
  resetEmail: { limit: 3, windowSec: 60 * 60 },
  resetIp: { limit: 10, windowSec: 60 * 60 },
  clientErrorIp: { limit: 30, windowSec: 60 * 60 },
} satisfies Record<string, RateRule>

export async function clientIp(): Promise<string> {
  try {
    const h = await headers()
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
  } catch {
    return "unknown"
  }
}

/** Counts one attempt for `key` and reports whether it is still within the rule. */
export async function hit(key: string, rule: RateRule): Promise<{ allowed: boolean; retryAfterSec: number }> {
  try {
    const rows = await prisma.$queryRaw<{ count: number; retry: number }[]>`
      INSERT INTO rate_limits (key, count, "resetAt")
      VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${rule.windowSec}::double precision))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE rate_limits.count + 1 END,
        "resetAt" = CASE WHEN rate_limits."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE rate_limits."resetAt" END
      RETURNING count, CEIL(EXTRACT(EPOCH FROM ("resetAt" - (now() AT TIME ZONE 'UTC'))))::int AS retry`
    if (Math.random() < 0.02) {
      // Occasional housekeeping of long-expired windows.
      await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 86_400_000) } } })
    }
    const row = rows[0]
    return { allowed: row.count <= rule.limit, retryAfterSec: Math.max(0, row.retry) }
  } catch (err) {
    console.error("[rate-limit] unavailable, allowing request:", (err as Error).message)
    return { allowed: true, retryAfterSec: 0 }
  }
}

export async function resetRateLimit(key: string) {
  // try/catch (not .catch) so even a synchronous failure can't break the login that called it.
  try {
    await prisma.rateLimit.deleteMany({ where: { key } })
  } catch (err) {
    console.error("[rate-limit] could not reset", key, (err as Error).message)
  }
}

export function minutesText(sec: number) {
  const m = Math.max(1, Math.ceil(sec / 60))
  return m === 1 ? "1 minuto" : `${m} minutos`
}

/** Throws 429 when the key is over its limit. `tooMany` is the full phrase, e.g. "Demasiadas solicitudes". */
export async function assertRateLimit(key: string, rule: RateRule, tooMany = "Demasiados intentos") {
  const r = await hit(key, rule)
  if (!r.allowed) {
    throw new ApiError(429, "rate_limited", `${tooMany}. Inténtalo de nuevo en ${minutesText(r.retryAfterSec)}.`)
  }
}
