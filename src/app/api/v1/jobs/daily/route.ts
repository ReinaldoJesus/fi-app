
import { fail, ok } from "@/server/http"
import { ApiError } from "@/server/errors"
import { runDailyJob } from "@/server/services/push"

// Runs for every user; give it room beyond the default function timeout.
export const maxDuration = 60

/**
 * Daily job triggered by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer $CRON_SECRET"; anything else is rejected.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(new ApiError(401, "unauthorized", "No autorizado"))
  }
  return ok(await runDailyJob())
}
