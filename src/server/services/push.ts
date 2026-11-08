import "server-only"
import { z } from "zod"
import webpush from "web-push"
import { prisma } from "@/lib/prisma"
import { fmtCurrency } from "@/lib/fmt"
import { PushSubscriptionInput } from "@/lib/api/schemas"
import { ApiError, notFound } from "../errors"
import { todayParts } from "../dates"
import { getBudgetMonth } from "./budgets"
import { generateDueRecurring } from "./recurring"
import { pruneErrorLogs } from "./monitoring"

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

const publicKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || undefined
export const pushConfigured = () => !!(publicKey() && process.env.VAPID_PRIVATE_KEY)

let vapidReady = false
function ensureVapid() {
  if (!pushConfigured()) throw new ApiError(503, "push_not_configured", "Las notificaciones push no están configuradas en el servidor")
  if (vapidReady) return
  // Contact for the push services: explicit VAPID_SUBJECT, else the production URL.
  // A blank or malformed VAPID_SUBJECT (e.g. a stray space in the dashboard) falls back instead of breaking push.
  const explicit = process.env.VAPID_SUBJECT?.trim()
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/^https?:\/\//, "")
  const subject = explicit && /^(https:\/\/\S+|mailto:\S+@\S+)$/.test(explicit)
    ? explicit
    : host ? `https://${host}` : "https://clarifi.vercel.app"
  webpush.setVapidDetails(subject, publicKey()!.trim(), process.env.VAPID_PRIVATE_KEY!.trim())
  vapidReady = true
}

export async function listPushDevices(userId: string) {
  const devices = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  return { configured: pushConfigured(), publicKey: publicKey() ?? null, devices: devices.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })) }
}

/** Registers this browser/device. The endpoint is unique: a device moves to whoever subscribed last. */
export async function savePushSubscription(userId: string, input: z.infer<typeof PushSubscriptionInput>, userAgent?: string | null) {
  const data = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null }
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
    select: { id: true },
  })
  return { id: row.id, subscribed: true }
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  const res = await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
  if (!res.count) throw notFound("Suscripción")
  return { subscribed: false }
}

/** Sends to every device of the user; drops devices the push service says are gone. */
export async function sendToUser(userId: string, payload: PushPayload) {
  ensureVapid()
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  let sent = 0
  let removed = 0
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12, urgency: "normal" },
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        removed++
      } else {
        console.error("[push] send failed", status, (err as Error).message)
      }
    }
  }))
  return { devices: subs.length, sent, removed }
}

export async function sendTestPush(userId: string) {
  const r = await sendToUser(userId, {
    title: "Clarifi",
    body: "¡Listo! Así se verán tus avisos de cobros y presupuestos.",
    url: "/dashboard/profile",
    tag: "test",
  })
  if (!r.devices) throw new ApiError(400, "no_devices", "Activa las notificaciones en este dispositivo primero")
  return r
}

/** Records an alert as sent; false when it was already sent (so it's never repeated). */
async function claimDelivery(userId: string, key: string) {
  try {
    await prisma.notificationDelivery.create({ data: { userId, key } })
    return true
  } catch {
    return false
  }
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Alerts for one user: subscriptions billed tomorrow and budgets at 90% / 100%. */
async function alertsForUser(user: { id: string; notifSubscriptions: boolean; notifBudget: boolean }) {
  const today = todayParts()
  const tomorrow = todayParts(new Date(Date.now() + 86_400_000))
  const period = `${today.year}-${String(today.month).padStart(2, "0")}`
  const alerts: (PushPayload & { key: string })[] = []

  if (user.notifSubscriptions) {
    const isLastDay = tomorrow.day === lastDayOfMonth(tomorrow.year, tomorrow.month)
    const subs = await prisma.subscription.findMany({
      where: { userId: user.id, active: true, billingDay: isLastDay ? { gte: tomorrow.day } : tomorrow.day },
      select: { id: true, name: true, amount: true, currency: true },
    })
    const billPeriod = `${tomorrow.year}-${String(tomorrow.month).padStart(2, "0")}`
    for (const s of subs) {
      alerts.push({
        key: `sub:${s.id}:${billPeriod}`,
        title: `Mañana se cobra ${s.name}`,
        body: `${fmtCurrency(Number(s.amount), s.currency)} · Revisa que tengas saldo.`,
        url: "/dashboard/subscriptions",
        tag: `sub-${s.id}`,
      })
    }
  }

  if (user.notifBudget) {
    const month = await getBudgetMonth(user.id, today.month, today.year)
    for (const item of month.items) {
      if (!item.budget) continue
      const pct = item.spent / item.budget
      const level = pct >= 1 ? 100 : pct >= 0.9 ? 90 : 0
      if (!level) continue
      alerts.push({
        key: `budget${level}:${item.categoryId}:${period}`,
        title: level === 100 ? `Superaste el presupuesto de ${item.name}` : `${item.name}: llevas el ${Math.round(pct * 100)}% del presupuesto`,
        body: `${fmtCurrency(item.spent)} de ${fmtCurrency(item.budget)} este mes.`,
        url: "/dashboard/budgets",
        tag: `budget-${item.categoryId}`,
      })
    }
  }

  let sent = 0
  for (const { key, ...payload } of alerts) {
    if (!(await claimDelivery(user.id, key))) continue
    const r = await sendToUser(user.id, payload)
    if (r.sent) sent++
  }
  return sent
}

/**
 * Daily job (Vercel Cron, 09:00 Chile): generates due recurring movements for
 * everyone, sends push alerts, and prunes expired operational data.
 */
export async function runDailyJob() {
  const result = { recurringGenerated: 0, usersNotified: 0, alertsSent: 0, errorLogsPruned: 0, failures: 0 }

  const withRecurring = await prisma.recurringTransaction.findMany({ where: { active: true }, select: { userId: true }, distinct: ["userId"] })
  for (const { userId } of withRecurring) {
    try {
      result.recurringGenerated += (await generateDueRecurring(userId)).generated
    } catch (err) {
      result.failures++
      console.error("[daily] recurring failed for user", userId, (err as Error).message)
    }
  }

  if (pushConfigured()) {
    const users = await prisma.user.findMany({
      where: { pushSubscriptions: { some: {} } },
      select: { id: true, notifSubscriptions: true, notifBudget: true },
    })
    for (const u of users) {
      try {
        const sent = await alertsForUser(u)
        result.alertsSent += sent
        if (sent) result.usersNotified++
      } catch (err) {
        result.failures++
        console.error("[daily] alerts failed for user", u.id, (err as Error).message)
      }
    }
  }

  result.errorLogsPruned = (await pruneErrorLogs()).deleted
  const now = new Date()
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } })
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } })
  await prisma.notificationDelivery.deleteMany({ where: { sentAt: { lt: new Date(Date.now() - 400 * 86_400_000) } } })
  return result
}
