import "server-only"
import { prisma } from "@/lib/prisma"
import { cardFromNotes, cardKey } from "@/lib/autoSources"

/**
 * Card → account memory, kept free of other services so transactions.ts can use it
 * (fixing the account of an Apple Pay movement teaches the next one).
 */

export async function accountForCard(userId: string, card: string | undefined | null) {
  if (!card?.trim()) return null
  const row = await prisma.cardAlias.findUnique({
    where: { userId_alias: { userId, alias: cardKey(card) } },
    select: { accountId: true },
  })
  return row?.accountId ?? null
}

export async function rememberCard(userId: string, card: string, accountId: string) {
  const alias = cardKey(card)
  await prisma.cardAlias.upsert({
    where: { userId_alias: { userId, alias } },
    create: { userId, alias, label: card.trim().slice(0, 120), accountId },
    update: { accountId },
  })
}

/** Called after a movement's account is changed by hand: if it came from a card, remember it. */
export async function learnFromAccountChange(userId: string, notes: string | null, accountId: string) {
  const card = cardFromNotes(notes)
  if (card) await rememberCard(userId, card, accountId)
}
