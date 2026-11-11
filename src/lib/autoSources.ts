import { norm } from "./wallet"

/**
 * Label stored at the start of an automatic movement's notes ("Apple Pay · Santander Visa").
 * It is how the app recognises automatic movements and which card they came from.
 */
export const SOURCE_LABEL = { applepay: "Apple Pay", notification: "Android", email: "Correo del banco", sms: "SMS del banco", whatsapp: "WhatsApp" } as const

/** Sources that carry a card name after " · ". */
export const CARD_SOURCES = [SOURCE_LABEL.applepay, SOURCE_LABEL.notification, SOURCE_LABEL.email, SOURCE_LABEL.sms]

/** "Apple Pay · Santander Visa" → "Santander Visa"; null when there is no card. */
export function cardFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  for (const label of CARD_SOURCES) {
    if (notes.startsWith(`${label} · `)) return notes.slice(label.length + 3).trim() || null
  }
  return null
}

/** Key a card is remembered by: case, accents and spacing do not matter. */
export const cardKey = (card: string) => norm(card).slice(0, 120)
