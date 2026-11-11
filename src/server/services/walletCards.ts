import "server-only"
import { prisma } from "@/lib/prisma"
import { CARD_SOURCES, cardFromNotes, cardKey } from "@/lib/autoSources"
import { notFound } from "../errors"
import { rememberCard } from "./cardAliases"
import { updateTransaction } from "./transactions"

/**
 * The cards the phone has reported (Apple Pay, Android, bank e-mails / SMS), and the
 * account each one goes to. Choosing an account can also move the payments already
 * recorded with that card, with their balances.
 */

export type WalletCard = {
  card: string
  /** The account chosen for it, or null if Clarifi is still guessing. */
  accountId: string | null
  payments: number
  /** Where its payments are today: [accountId, count], most first. */
  current: [string, number][]
}

const autoWhere = (userId: string) => ({ userId, type: { not: "TRANSFER" as const }, OR: CARD_SOURCES.map(l => ({ notes: { startsWith: `${l} · ` } })) })

export async function listWalletCards(userId: string): Promise<WalletCard[]> {
  const [groups, aliases] = await Promise.all([
    prisma.transaction.groupBy({ by: ["notes", "accountId"], where: autoWhere(userId), _count: { _all: true } }),
    prisma.cardAlias.findMany({ where: { userId }, select: { alias: true, label: true, accountId: true } }),
  ])
  const cards = new Map<string, WalletCard & { counts: Map<string, number> }>()
  const entry = (label: string) => {
    const key = cardKey(label)
    let c = cards.get(key)
    if (!c) { c = { card: label, accountId: null, payments: 0, current: [], counts: new Map() }; cards.set(key, c) }
    return c
  }
  for (const g of groups) {
    const label = cardFromNotes(g.notes)
    if (!label) continue
    const c = entry(label)
    c.payments += g._count._all
    c.counts.set(g.accountId, (c.counts.get(g.accountId) ?? 0) + g._count._all)
  }
  for (const a of aliases) entry(a.label).accountId = a.accountId
  return [...cards.values()]
    .map(({ counts, ...c }) => ({ ...c, current: [...counts].sort((a, b) => b[1] - a[1]) }))
    .sort((a, b) => b.payments - a.payments)
}

/** This card goes to this account from now on; `moveExisting` also fixes the payments already recorded. */
export async function assignWalletCard(userId: string, card: string, accountId: string, moveExisting: boolean) {
  const account = await prisma.finAccount.findFirst({ where: { id: accountId, userId }, select: { id: true, name: true } })
  if (!account) throw notFound("Cuenta")
  await rememberCard(userId, card, accountId)

  let moved = 0
  if (moveExisting) {
    const key = cardKey(card)
    const candidates = await prisma.transaction.findMany({
      where: { ...autoWhere(userId), accountId: { not: accountId } },
      select: { id: true, notes: true },
    })
    // One by one through updateTransaction: each move fixes both balances.
    for (const t of candidates) {
      const c = cardFromNotes(t.notes)
      if (c && cardKey(c) === key) { await updateTransaction(userId, t.id, { accountId }); moved++ }
    }
  }
  return { card, account, moved }
}
