import "server-only"
import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { fmtCurrency } from "@/lib/fmt"
import { parseChatMessage } from "@/lib/chatParse"
import { ApiError, badRequest } from "../errors"
import { recordShortcutTransaction, SOURCE_LABEL } from "./shortcuts"
import { deleteTransactions } from "./transactions"
import { reportError } from "./monitoring"

/**
 * WhatsApp bot (Meta WhatsApp Cloud API). People write "gasté 5 lucas en el uber"
 * and the movement is recorded with the same engine as Apple Pay / bank notices.
 *
 * Environment (Vercel → Settings → Environment Variables):
 *   WHATSAPP_TOKEN            permanent System User token (whatsapp_business_messaging)
 *   WHATSAPP_PHONE_NUMBER_ID  the bot's "Phone number ID" from API Setup
 *   WHATSAPP_APP_SECRET       App settings → Basic → App secret (signs each webhook)
 *   WHATSAPP_VERIFY_TOKEN     any long random text, also typed in Meta's webhook form
 *   WHATSAPP_BOT_NUMBER       the bot's number, digits only (for the wa.me button)
 */

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v24.0"
const CODE_TTL_MS = 10 * 60_000
const UNDO_WINDOW_MS = 24 * 3600_000

const env = () => ({
  token: process.env.WHATSAPP_TOKEN,
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  botNumber: process.env.WHATSAPP_BOT_NUMBER?.replace(/\D/g, "") || null,
})

const hash = (code: string) => crypto.createHash("sha256").update(code).digest("hex")
const digits = (s: string) => s.replace(/\D/g, "")
/** +56 9 •••• 5678: enough to recognise it, not enough to copy it. */
const maskPhone = (p: string) => `+${p.slice(0, p.length - 8)} ${p.slice(-8, -7)} •••• ${p.slice(-4)}`

// ── Settings (used by the app) ─────────────────────────────────────────────

export async function getWhatsAppStatus(userId: string) {
  // No token on purpose: locally the bot runs without sending (replies are only logged).
  const { botNumber, phoneId, appSecret } = env()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { whatsappPhone: true } })
  return {
    enabled: !!(botNumber && phoneId && appSecret),
    botNumber,
    linked: !!user?.whatsappPhone,
    phone: user?.whatsappPhone ? maskPhone(user.whatsappPhone) : null,
  }
}

/** A 6-digit code the person sends to the bot from their WhatsApp; it ties that number to this account. */
export async function createWhatsAppLinkCode(userId: string) {
  const { botNumber } = env()
  if (!botNumber) throw new ApiError(503, "whatsapp_disabled", "El bot de WhatsApp todavía no está configurado")
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
    const expiresAt = new Date(Date.now() + CODE_TTL_MS)
    try {
      await prisma.user.update({ where: { id: userId }, data: { whatsappCodeHash: hash(code), whatsappCodeExpiresAt: expiresAt } })
    } catch {
      continue // another account holds the same code right now: draw again
    }
    const text = `Hola Clarifi, mi código es ${code}`
    return { code, expiresAt, url: `https://wa.me/${botNumber}?text=${encodeURIComponent(text)}` }
  }
  throw badRequest("No pude generar el código, inténtalo de nuevo")
}

export async function unlinkWhatsApp(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { whatsappPhone: null, whatsappCodeHash: null, whatsappCodeExpiresAt: null } })
  return { unlinked: true as const }
}

// ── Webhook (used by Meta) ─────────────────────────────────────────────────

/** Meta's one-time check when the webhook URL is saved: echo the challenge if the token matches. */
export function verifyWebhookSubscription(params: URLSearchParams): string | null {
  const { verifyToken } = env()
  if (!verifyToken) return null
  return params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken ? params.get("hub.challenge") : null
}

/** Every webhook is signed with the app secret: anything else is not from Meta. */
export function validSignature(rawBody: string, header: string | null): boolean {
  const { appSecret } = env()
  if (!appSecret || !header?.startsWith("sha256=")) return false
  const expected = Buffer.from(crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex"))
  const given = Buffer.from(header.slice(7))
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

type IncomingMessage = { from: string; id: string; type: string; text?: { body?: string } }
type WebhookPayload = { entry?: { changes?: { value?: { messages?: IncomingMessage[] } }[] }[] }

/** Handles every message in a webhook; returns the replies (also sent to WhatsApp when configured). */
export async function handleWebhook(payload: WebhookPayload) {
  const replies: { to: string; text: string }[] = []
  const messages = (payload.entry ?? []).flatMap(e => e.changes ?? []).flatMap(c => c.value?.messages ?? [])
  for (const msg of messages) {
    // Meta retries when unsure we got it: handle each message id once.
    try {
      await prisma.whatsAppMessage.create({ data: { id: msg.id } })
    } catch {
      continue
    }
    const from = digits(msg.from)
    let text: string
    try {
      text = await reply(from, msg)
    } catch (err) {
      const e = err as { message?: string; stack?: string }
      if (!(err instanceof ApiError) || err.status >= 500) {
        await reportError({ source: "api", message: `whatsapp: ${e?.message ?? String(err)}`, stack: e?.stack, path: "/api/v1/whatsapp" })
      }
      text = err instanceof ApiError && err.status < 500 ? `✗ ${err.message}` : "✗ Algo falló de mi lado. Inténtalo de nuevo en un rato."
    }
    replies.push({ to: from, text })
    await sendText(from, text)
  }
  return replies
}

const HELP = [
  "Hola 👋 Soy Clarifi. Escríbeme tus gastos como te salgan:",
  "• gasté 5 lucas en el uber",
  "• 15k super",
  "• me pagaron el sueldo 1.200.000",
  "",
  "También entiendo:",
  "• *borrar* → deshace lo último que anotaste aquí",
  "• *saldo* → tus cuentas",
  "• *mes* → cuánto llevas este mes",
].join("\n")

async function reply(from: string, msg: IncomingMessage): Promise<string> {
  const body = msg.type === "text" ? msg.text?.body ?? "" : ""
  const intent = parseChatMessage(body)

  if (intent.kind === "link") return link(from, intent.code)

  const user = await prisma.user.findUnique({ where: { whatsappPhone: from }, select: { id: true } })
  if (!user) {
    return "Hola 👋 Todavía no sé de quién es este WhatsApp. Abre Clarifi → Perfil → *Conectar WhatsApp* y envíame el mensaje con tu código."
  }
  if (msg.type !== "text") return "Por ahora solo entiendo mensajes de texto 🙂 Escríbeme, por ejemplo: *gasté 5 lucas en el uber*"

  switch (intent.kind) {
    case "help": return HELP
    case "undo": return undo(user.id)
    case "balance": return balances(user.id)
    case "month": return month(user.id)
    case "unknown": return `No encontré un monto en tu mensaje 🤔\n\n${HELP}`
    case "movement": {
      const r = await recordShortcutTransaction(user.id, {
        amount: intent.amount, merchant: intent.description, type: intent.type, source: "whatsapp", dryRun: false,
      })
      return "message" in r ? `${r.message}\n\n¿Me equivoqué? Escribe *borrar*.` : "✓ Registrado"
    }
  }
}

async function link(from: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { whatsappCodeHash: hash(code) },
    select: { id: true, name: true, whatsappCodeExpiresAt: true },
  })
  if (!user || !user.whatsappCodeExpiresAt || user.whatsappCodeExpiresAt < new Date()) {
    return "Ese código no sirve o ya venció. En Clarifi → Perfil toca *Conectar WhatsApp* para obtener uno nuevo."
  }
  await prisma.$transaction([
    // A number belongs to one account: free it from any earlier one.
    prisma.user.updateMany({ where: { whatsappPhone: from, NOT: { id: user.id } }, data: { whatsappPhone: null } }),
    prisma.user.update({ where: { id: user.id }, data: { whatsappPhone: from, whatsappCodeHash: null, whatsappCodeExpiresAt: null } }),
  ])
  const first = user.name?.split(" ")[0]
  return `✓ Listo${first ? `, ${first}` : ""}. Tu WhatsApp quedó conectado a Clarifi.\n\n${HELP}`
}

async function undo(userId: string) {
  const last = await prisma.transaction.findFirst({
    where: { userId, notes: { startsWith: SOURCE_LABEL.whatsapp }, createdAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, description: true, account: { select: { currency: true } } },
  })
  if (!last) return "No hay nada reciente anotado por WhatsApp para borrar."
  await deleteTransactions(userId, [last.id])
  return `🗑️ Borrado: ${fmtCurrency(Number(last.amount), last.account.currency)}${last.description ? ` · ${last.description}` : ""}`
}

async function balances(userId: string) {
  const accounts = await prisma.finAccount.findMany({
    where: { userId }, orderBy: { createdAt: "asc" },
    select: { name: true, balance: true, currency: true, type: true },
  })
  if (!accounts.length) return "Todavía no tienes cuentas en Clarifi."
  return ["💰 Tus cuentas:", ...accounts.map(a => `• ${a.name}: ${fmtCurrency(Number(a.balance), a.currency)}`)].join("\n")
}

async function month(userId: string) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const [rows, user] = await Promise.all([
    prisma.transaction.groupBy({ by: ["type"], where: { userId, date: { gte: start }, type: { in: ["EXPENSE", "INCOME"] } }, _sum: { amount: true } }),
    prisma.finAccount.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { currency: true } }),
  ])
  const cur = user?.currency ?? "CLP"
  const sum = (t: string) => Number(rows.find(r => r.type === t)?._sum.amount ?? 0)
  const label = now.toLocaleDateString("es-CL", { month: "long" })
  return `📊 ${label[0].toUpperCase()}${label.slice(1)}:\n• Gastos: ${fmtCurrency(sum("EXPENSE"), cur)}\n• Ingresos: ${fmtCurrency(sum("INCOME"), cur)}\n• Balance: ${fmtCurrency(sum("INCOME") - sum("EXPENSE"), cur)}`
}

/** Sends a text message through the Cloud API. Without credentials (local dev) it only logs. */
async function sendText(to: string, body: string) {
  const { token, phoneId } = env()
  if (!token || !phoneId) {
    if (process.env.NODE_ENV !== "production") console.log(`[whatsapp] → ${to.slice(-4)}: ${body.split("\n")[0]}`)
    return
  }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } }),
  })
  if (!res.ok) {
    await reportError({ source: "api", message: `whatsapp send ${res.status}: ${(await res.text()).slice(0, 500)}`, path: "/api/v1/whatsapp" })
  }
}
