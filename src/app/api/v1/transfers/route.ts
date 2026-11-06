import { ok, readJson, withUser } from "@/server/http"
import { TransferCreate } from "@/lib/api/schemas"
import { createTransfer } from "@/server/services/transactions"

export const POST = withUser(async ({ req, userId }) =>
  ok(await createTransfer(userId, TransferCreate.parse(await readJson(req))), 201),
)
