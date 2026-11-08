import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { notFound, unauthorized, ApiError } from "../errors"
import { assertRateLimit, RULES } from "../rateLimit"

/**
 * Personal tokens let an automation (the iPhone Shortcuts app) write to one
 * person's Clarifi without a browser session. The token is shown once; only its
 * SHA-256 is stored, so a database leak does not leak usable tokens.
 */
const MAX_TOKENS = 5
const hash = (token: string) => createHash("sha256").update(token).digest("hex")

export async function listApiTokens(userId: string) {
  const rows = await prisma.apiToken.findMany({
    where: { userId }, orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  })
  return rows.map(r => ({ ...r, lastUsedAt: r.lastUsedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }))
}

export async function createApiToken(userId: string, name: string) {
  await assertRateLimit(`token:create:${userId}`, RULES.tokenCreate, "Demasiados tokens creados")
  if ((await prisma.apiToken.count({ where: { userId } })) >= MAX_TOKENS) {
    throw new ApiError(409, "conflict", `Puedes tener hasta ${MAX_TOKENS} tokens. Revoca uno que no uses.`)
  }
  const token = `clf_${randomBytes(24).toString("base64url")}`
  const row = await prisma.apiToken.create({
    data: { userId, name, tokenHash: hash(token), prefix: token.slice(0, 8) },
    select: { id: true, name: true, prefix: true, createdAt: true },
  })
  // The only time the plain token leaves the server.
  return { ...row, createdAt: row.createdAt.toISOString(), token }
}

export async function revokeApiToken(userId: string, id: string) {
  const { count } = await prisma.apiToken.deleteMany({ where: { id, userId } })
  if (!count) throw notFound("Token")
  return { revoked: true as const }
}

/** Resolves `Authorization: Bearer clf_…` to its user; 401 for anything else. */
export async function userFromBearer(req: Request): Promise<string> {
  const m = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)\s*$/i)
  return userFromToken(m?.[1])
}

/** Resolves a personal token (from the header or the personal URL) to its user. */
export async function userFromToken(token: string | undefined | null): Promise<string> {
  if (!token || !/^clf_[A-Za-z0-9_-]{20,}$/.test(token)) throw unauthorized()
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hash(token) }, select: { id: true, userId: true } })
  if (!row) throw unauthorized()
  await assertRateLimit(`token:use:${row.id}`, RULES.shortcutToken, "Demasiados movimientos seguidos")
  await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
  return row.userId
}
