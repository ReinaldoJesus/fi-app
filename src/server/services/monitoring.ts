import "server-only"
import { prisma } from "@/lib/prisma"
import { emailLayout, sendEmail } from "../email"

export type ErrorReport = {
  source: "server" | "api" | "client"
  message: string
  stack?: string | null
  path?: string | null
  digest?: string | null
  userId?: string | null
  userAgent?: string | null
  /** false to record without emailing (automated tests). */
  alert?: boolean
}

const ALERT_WINDOW_MS = 15 * 60 * 1000
const RETENTION_DAYS = 90

/**
 * Stores an error and, at most once per 15 minutes, emails ALERT_EMAIL about it.
 * Never throws: monitoring must not turn one failure into two.
 */
export async function reportError(report: ErrorReport) {
  try {
    const row = await prisma.errorLog.create({
      data: {
        source: report.source,
        message: report.message.slice(0, 2000) || "(sin mensaje)",
        stack: report.stack?.slice(0, 8000) ?? null,
        path: report.path?.slice(0, 500) ?? null,
        digest: report.digest?.slice(0, 100) ?? null,
        userId: report.userId ?? null,
        userAgent: report.userAgent?.slice(0, 300) ?? null,
      },
    })

    const to = process.env.ALERT_EMAIL
    if (!to || report.alert === false) return
    const since = new Date(Date.now() - ALERT_WINDOW_MS)
    const earlier = await prisma.errorLog.count({ where: { createdAt: { gte: since }, id: { not: row.id }, NOT: { message: { startsWith: "[test]" } } } })
    if (earlier > 0) return // an alert already went out for this burst

    const last24h = await prisma.errorLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } })
    const where = report.path ? ` en ${report.path}` : ""
    const { html, text } = emailLayout({
      title: `Error en Clarifi${where}`,
      intro: `${report.message.slice(0, 300)} — origen: ${report.source}${report.digest ? `, digest ${report.digest}` : ""}. Errores en las últimas 24 h: ${last24h}. No se enviarán más avisos durante 15 minutos; todos quedan en la tabla error_logs.`,
      footer: `Id del registro: ${row.id}`,
    })
    await sendEmail({ to, subject: `⚠️ Clarifi: error${where}`, html, text })
  } catch (err) {
    console.error("[monitoring] could not record error:", (err as Error).message, "| original:", report.message)
  }
}

/** Deletes error logs older than the retention promised in the privacy policy. */
export async function pruneErrorLogs() {
  const res = await prisma.errorLog.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } },
  })
  return { deleted: res.count }
}
