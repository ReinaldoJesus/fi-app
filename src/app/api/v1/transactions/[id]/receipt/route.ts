
import { ok, withUser } from "@/server/http"
import { badRequest } from "@/server/errors"
import { deleteReceipt, getReceipt, saveReceipt } from "@/server/services/receipts"

type P = { id: string }

/** The receipt image itself (owner only). */
export const GET = withUser<P>(async ({ userId, params }) => {
  const r = await getReceipt(userId, params.id)
  return new Response(new Uint8Array(r.data), {
    headers: {
      "content-type": r.mimeType,
      "cache-control": "private, max-age=86400",
      "last-modified": r.createdAt.toUTCString(),
      "x-content-type-options": "nosniff",
    },
  })
})

/** Attaches or replaces the receipt photo (multipart/form-data, field "file"). */
export const PUT = withUser<P>(async ({ req, userId, params }) => {
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) throw badRequest("Adjunta la foto en el campo file", { file: ["Archivo requerido"] })
  return ok(await saveReceipt(userId, params.id, Buffer.from(await file.arrayBuffer())))
})

export const DELETE = withUser<P>(async ({ userId, params }) => ok(await deleteReceipt(userId, params.id)))
