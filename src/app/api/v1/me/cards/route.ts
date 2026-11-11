import { ok, readJson, withUser } from "@/server/http"
import { WalletCardAssign } from "@/lib/api/schemas"
import { assignWalletCard, listWalletCards } from "@/server/services/walletCards"

/** Cards the phone has reported and the account each one goes to. */
export const GET = withUser(async ({ userId }) => ok(await listWalletCards(userId)))

/** Card → account; moveExisting (default true) also moves its recorded payments. */
export const PUT = withUser(async ({ req, userId }) => {
  const { card, accountId, moveExisting } = WalletCardAssign.parse(await readJson(req))
  return ok(await assignWalletCard(userId, card, accountId, moveExisting))
})
