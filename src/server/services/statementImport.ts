import "server-only"
import { prisma } from "@/lib/prisma"
import { badRequest } from "../errors"
import { assertAccounts, num } from "./guards"
import { norm, parseStatement, StatementError, type PreviewRow } from "../statement/parse"

export { MAX_STATEMENT_BYTES, STATEMENT_EXTENSIONS } from "../statement/parse"

/**
 * Turns a bank statement (Excel or CSV) into movements ready for
 * POST /transactions/import, without saving anything.
 */
export async function previewStatement(userId: string, file: { name: string; bytes: Buffer }, accountId?: string) {
  if (accountId) await assertAccounts(userId, [accountId])

  let parsed: ReturnType<typeof parseStatement>
  try {
    parsed = parseStatement(file)
  } catch (err) {
    if (err instanceof StatementError) throw badRequest(err.message)
    throw err
  }
  const { rows: out, categoryNames, skipped, truncated, sheet } = parsed

  // Category: the file's own column, else how the user categorized the same description before.
  const categories = await prisma.category.findMany({ where: { userId }, select: { id: true, name: true, type: true } })
  const byName = new Map(categories.map(c => [`${c.type}:${norm(c.name)}`, c.id]))
  const descriptions = [...new Set(out.map(r => r.description).filter(Boolean))]
  const history = descriptions.length
    ? await prisma.transaction.findMany({
        where: { userId, description: { in: descriptions }, categoryId: { not: null } },
        select: { description: true, type: true, categoryId: true },
        orderBy: { date: "desc" },
      })
    : []
  const learned = new Map<string, string>()
  for (const h of history) {
    const key = `${h.type}:${h.description}`
    if (!learned.has(key) && h.categoryId) learned.set(key, h.categoryId)
  }

  // Duplicates: same date + amount + type already in the account (counted, so two equal coffees stay two).
  const existing = new Map<string, number>()
  if (accountId) {
    const dates = out.map(r => r.date).sort()
    const txs = await prisma.transaction.findMany({
      where: {
        userId, accountId, type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: new Date(`${dates[0]}T00:00:00.000Z`), lte: new Date(`${dates[dates.length - 1]}T23:59:59.999Z`) },
      },
      select: { date: true, amount: true, type: true },
    })
    for (const t of txs) {
      const key = `${t.date.toISOString().slice(0, 10)}|${num(t.amount)}|${t.type}`
      existing.set(key, (existing.get(key) ?? 0) + 1)
    }
  }

  const result: PreviewRow[] = out.map((r, k) => {
    const named = categoryNames[k] ? byName.get(`${r.type}:${categoryNames[k]}`) : undefined
    const key = `${r.date}|${r.amount}|${r.type}`
    const left = existing.get(key) ?? 0
    if (left > 0) existing.set(key, left - 1)
    return { ...r, categoryId: named ?? learned.get(`${r.type}:${r.description}`) ?? null, duplicate: left > 0 }
  })

  return {
    fileName: file.name,
    sheet,
    rows: result,
    skipped,
    duplicates: result.filter(r => r.duplicate).length,
    truncated,
  }
}
