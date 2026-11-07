
import { ok, withUser } from "@/server/http"
import { badRequest } from "@/server/errors"
import { MAX_STATEMENT_BYTES, previewStatement, STATEMENT_EXTENSIONS } from "@/server/services/statementImport"

/**
 * Reads a bank statement (multipart/form-data: file, optional accountId) and
 * returns the detected movements without saving them. Confirm with POST /transactions/import.
 */
export const POST = withUser(async ({ req, userId }) => {
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) throw badRequest("Adjunta el archivo de la cartola en el campo file", { file: ["Archivo requerido"] })
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."))
  if (!STATEMENT_EXTENSIONS.includes(ext)) {
    throw badRequest("Formato no soportado. Usa Excel (.xls, .xlsx) o CSV.", { file: ["Formato no soportado"] })
  }
  if (file.size > MAX_STATEMENT_BYTES) throw badRequest("El archivo supera los 4 MB", { file: ["Máximo 4 MB"] })
  const accountId = form?.get("accountId")
  return ok(await previewStatement(
    userId,
    { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
    typeof accountId === "string" && accountId ? accountId : undefined,
  ))
})
