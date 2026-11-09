import { handleWebhook, validSignature, verifyWebhookSubscription } from "@/server/services/whatsapp"
import { reportError } from "@/server/services/monitoring"

/**
 * Webhook for the WhatsApp Cloud API (configured in Meta → WhatsApp → Configuration).
 * Not behind a session: Meta proves who it is with the verify token (GET) and with
 * an HMAC signature of every body (POST).
 */

export async function GET(req: Request) {
  const challenge = verifyWebhookSubscription(new URL(req.url).searchParams)
  return challenge
    ? new Response(challenge, { headers: { "content-type": "text/plain" } })
    : new Response("Forbidden", { status: 403 })
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 })
  let replies: Awaited<ReturnType<typeof handleWebhook>> = []
  try {
    replies = await handleWebhook(JSON.parse(raw))
  } catch (err) {
    // Still 200: an error status makes Meta re-send the same webhook for days.
    const e = err as { message?: string; stack?: string }
    await reportError({ source: "api", message: `whatsapp webhook: ${e?.message ?? String(err)}`, stack: e?.stack, path: "/api/v1/whatsapp" })
  }
  // The replies help local tests; in production they only go to WhatsApp.
  return Response.json(process.env.NODE_ENV === "production" ? { ok: true } : { ok: true, replies })
}
