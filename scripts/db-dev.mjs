// Prepares the development database (a Neon branch, never production).
//
//   npm run db:dev            apply pending migrations to the dev database
//   npm run db:dev -- --reset wipe the dev database and rebuild it from the migrations
//
// Refuses to run when DATABASE_URL in .env.local still points at the production
// host (PROD_DB_HOST), so a copy-paste slip can never touch real data.
import fs from "node:fs"
import { spawnSync } from "node:child_process"

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")] }),
)
const host = url => { try { return new URL(url).hostname.replace("-pooler", "") } catch { return "" } }

const prod = env.PROD_DB_HOST
const dev = host(env.DATABASE_URL)
if (!prod) { console.error("✗ Falta PROD_DB_HOST en .env.local: no puedo comprobar que no sea producción."); process.exit(1) }
if (!dev) { console.error("✗ DATABASE_URL en .env.local no es una URL válida."); process.exit(1) }
if (dev === prod) {
  console.error(`✗ DATABASE_URL todavía apunta a PRODUCCIÓN (${prod}).
  Crea una rama "dev" en Neon (Branches → New branch), copia su cadena de conexión
  y reemplaza DATABASE_URL en .env.local. Luego vuelve a correr este comando.`)
  process.exit(1)
}

const reset = process.argv.includes("--reset")
console.log(`✓ Base de desarrollo: …${dev.slice(-30)} (producción: …${prod.slice(-30)})`)
console.log(reset ? "→ Borrando la base de desarrollo y recreándola desde las migraciones…" : "→ Aplicando migraciones pendientes…")
const args = reset ? ["prisma", "migrate", "reset", "--force"] : ["prisma", "migrate", "deploy"]
const r = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" })
if (r.status !== 0) process.exit(r.status ?? 1)
console.log(`
✓ Base de desarrollo lista.
  Reinicia el servidor local (npm run dev) y corre npm run test:api:
  la primera corrida crea sola la usuaria de prueba (TEST_USER_EMAIL).`)
