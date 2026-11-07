import { ok, readJson, withPublic } from "@/server/http"
import { Register } from "@/lib/api/schemas"
import { registerUser } from "@/server/services/profile"
import { clientIp } from "@/server/rateLimit"

/** Creates a user with email/password. Sign in afterwards through /api/auth (NextAuth). */
export const POST = withPublic(async ({ req }) => ok(await registerUser(Register.parse(await readJson(req)), { ip: await clientIp() }), 201))
