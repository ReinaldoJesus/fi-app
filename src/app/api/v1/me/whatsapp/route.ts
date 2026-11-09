import { ok, withUser } from "@/server/http"
import { createWhatsAppLinkCode, getWhatsAppStatus, unlinkWhatsApp } from "@/server/services/whatsapp"

/** Whether the bot is available and this account's WhatsApp is linked (number masked). */
export const GET = withUser(async ({ userId }) => ok(await getWhatsAppStatus(userId)))

/** New 6-digit link code (10 minutes) and the wa.me link that sends it. */
export const POST = withUser(async ({ userId }) => ok(await createWhatsAppLinkCode(userId), 201))

/** Disconnects WhatsApp from this account. */
export const DELETE = withUser(async ({ userId }) => ok(await unlinkWhatsApp(userId)))
