import { PrismaClient } from "@/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

/** Loud warning when the local server is wired to the production database. */
function warnIfProductionInDev(url: string | undefined) {
  const prod = process.env.PROD_DB_HOST
  if (process.env.NODE_ENV !== "development" || !prod || !url) return
  try {
    if (new URL(url).hostname.replace("-pooler", "") === prod) {
      console.warn("\n⚠️  El servidor local está usando la base de datos de PRODUCCIÓN. Cambia DATABASE_URL en .env.local por la rama dev de Neon.\n")
    }
  } catch { /* malformed URL: Prisma will report it */ }
}

function createPrismaClient() {
  warnIfProductionInDev(process.env.DATABASE_URL)
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma
