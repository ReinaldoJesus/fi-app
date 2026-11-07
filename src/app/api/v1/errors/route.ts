
import { auth } from "@/auth"
import { ok, readJson, withPublic } from "@/server/http"
import { ClientErrorReport } from "@/lib/api/schemas"
import { reportError } from "@/server/services/monitoring"
import { assertRateLimit, clientIp, RULES } from "@/server/rateLimit"

/** Browser-side errors (error boundaries, uncaught exceptions). Works signed in or out. */
export const POST = withPublic(async ({ req }) => {
  await assertRateLimit(`client-error:ip:${await clientIp()}`, RULES.clientErrorIp, "reportes")
  const input = ClientErrorReport.parse(await readJson(req))
  const session = await auth().catch(() => null)
  // Automated tests mark their reports so they're stored without emailing an alert.
  const isTest = req.headers.get("x-clarifi-test") === "1"
  await reportError({
    source: "client",
    ...input,
    message: isTest ? `[test] ${input.message}` : input.message,
    userId: session?.user?.id,
    userAgent: req.headers.get("user-agent"),
    alert: !isTest,
  })
  return ok({ recorded: true }, 202)
})
