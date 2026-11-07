import type { Instrumentation } from "next"

/**
 * Records every server-side error Next.js captures (Server Components, route
 * handlers, server actions, proxy) in error_logs and alerts by email.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const error = err as Error & { digest?: string }
  const { reportError } = await import("./server/services/monitoring")
  const ua = request.headers["user-agent"]
  await reportError({
    source: "server",
    message: `${error.message} [${context.routeType} ${context.routePath}]`,
    stack: error.stack,
    path: request.path,
    digest: error.digest,
    userAgent: Array.isArray(ua) ? ua[0] : ua,
  })
}
