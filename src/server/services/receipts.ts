import "server-only"
import { prisma } from "@/lib/prisma"
import { badRequest, notFound } from "../errors"

/** Images are resized in the browser first; this is a hard ceiling. */
export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024

/** Detects the real image type from its first bytes (never trust the declared type). */
function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  return null
}

async function assertOwnTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findFirst({ where: { id: transactionId, userId }, select: { id: true } })
  if (!tx) throw notFound("Transacción")
}

export async function saveReceipt(userId: string, transactionId: string, bytes: Buffer) {
  await assertOwnTransaction(userId, transactionId)
  if (bytes.length > MAX_RECEIPT_BYTES) throw badRequest("La imagen supera los 2 MB", { file: ["Máximo 2 MB"] })
  const mimeType = sniffImage(bytes)
  if (!mimeType) throw badRequest("Sube una foto en JPG, PNG o WebP", { file: ["Formato no soportado"] })
  const data = new Uint8Array(bytes)
  await prisma.receipt.upsert({
    where: { transactionId },
    create: { transactionId, mimeType, size: bytes.length, data },
    update: { mimeType, size: bytes.length, data, createdAt: new Date() },
  })
  return { transactionId, mimeType, size: bytes.length }
}

export async function getReceipt(userId: string, transactionId: string) {
  const r = await prisma.receipt.findFirst({
    where: { transactionId, transaction: { userId } },
    select: { mimeType: true, data: true, createdAt: true },
  })
  if (!r) throw notFound("Boleta")
  return r
}

export async function deleteReceipt(userId: string, transactionId: string) {
  const res = await prisma.receipt.deleteMany({ where: { transactionId, transaction: { userId } } })
  if (!res.count) throw notFound("Boleta")
  return { transactionId, deleted: true }
}
