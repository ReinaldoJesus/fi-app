import "server-only"
import { prisma } from "@/lib/prisma"
import { badRequest, notFound } from "../errors"

/** Decimal | number | null → number (API responses never expose Prisma Decimals). */
export const num = (v: unknown): number => (v == null ? 0 : Number(v))
export const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))

/** Throws 404 unless every account id belongs to the user. */
export async function assertAccounts(userId: string, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  if (!unique.length) return
  const found = await prisma.finAccount.count({ where: { userId, id: { in: unique } } })
  if (found !== unique.length) throw notFound("Cuenta")
}

/** Throws unless every category id belongs to the user (and matches the type, when given). */
export async function assertCategories(
  userId: string,
  ids: (string | null | undefined)[],
  type?: "INCOME" | "EXPENSE",
) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  if (!unique.length) return
  const found = await prisma.category.findMany({ where: { userId, id: { in: unique } }, select: { type: true } })
  if (found.length !== unique.length) throw notFound("Categoría")
  if (type && found.some(c => c.type !== type)) {
    throw badRequest("La categoría no corresponde al tipo de movimiento", { categoryId: ["Tipo de categoría incorrecto"] })
  }
}
