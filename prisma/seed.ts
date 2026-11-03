import { config } from "dotenv"
config({ path: ".env.local", override: true })

import * as XLSX from "xlsx"
import { Pool } from "pg"
import * as path from "path"
import * as fs from "fs"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  let text = ""
  for (let i = 0; i < strings.length; i++) {
    text += strings[i]
    if (i < values.length) text += `$${i + 1}`
  }
  const result = await pool.query(text, values as unknown[])
  return result.rows
}

const BANKING_PATH = "/mnt/c/Users/reina/OneDrive/Documentos/Mi personal/Historial Bancario"

// ─── Helpers ────────────────────────────────────────────────────────────────

function cuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function parseAmount(val: unknown): number {
  if (typeof val === "number") return Math.abs(val)
  if (typeof val === "string") {
    return Math.abs(parseFloat(val.replace(/[$\s.]/g, "").replace(",", "")))
  }
  return 0
}

function parseSantanderDate(ddmm: string, year: number): Date {
  const [d, m] = ddmm.split("/").map(Number)
  return new Date(year, m - 1, d, 12, 0, 0)
}

function parseBCIDate(ddmmyyyy: string): Date {
  const [d, m, y] = ddmmyyyy.split("-").map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function getYearMonth(filename: string): { year: number; month: number } {
  const months: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  }
  const lower = filename.toLowerCase()
  const year = parseInt(lower.match(/\d{4}/)?.[0] ?? "2025")
  const month = Object.entries(months).find(([m]) => lower.includes(m))?.[1] ?? 1
  return { year, month }
}

// Auto-categorización por descripción
function guessCategory(desc: string): string {
  const d = desc.toUpperCase()
  if (/SMART FIT|GYM|FITNESS|DEPORTE/.test(d)) return "Salud"
  if (/FARMACIA|CLINICA|MEDICAL|DOCTOR|DR\./.test(d)) return "Salud"
  if (/SUPERMERCADO|MARKET|LIDER|JUMBO|UNIMARC|SANTA ISABEL|TOTTUS|WALMART/.test(d)) return "Alimentación"
  if (/RESTAURANT|CAFE|COMIDA|SUSHI|PIZZA|BURGER|MCDONALDS|KFC|SUBWAY|DOMINOS|FOOD/.test(d)) return "Alimentación"
  if (/COPEC|SHELL|PETROBRAS|ENEX|BENCIN/.test(d)) return "Transporte"
  if (/UBER|CABIFY|DIDI|TAXI|BUS|METRO/.test(d)) return "Transporte"
  if (/NETFLIX|SPOTIFY|DISNEY|HBO|PRIME|STEAM|PLAYSTATION|XBOX|CINEMA|CINE/.test(d)) return "Entretenimiento"
  if (/AMAZON|MERCADOLIBRE|MERPAGO|RIPLEY|FALABELLA|PARIS|ZARA|H&M/.test(d)) return "Ropa"
  if (/OPENAI|CHATGPT|GOOGLE|APPLE|MICROSOFT|SOFTWARE|HOSTING/.test(d)) return "Educación"
  if (/SUELDO|SALARIO|REMUNERACION|HONORARIO/.test(d)) return "Sueldo"
  if (/TRANSFERENCIA|TRANSF|TRASPASO/.test(d)) return ""
  return ""
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Buscando usuario Reinaldo...")

  const users = await sql`SELECT id, email FROM "User" WHERE email = 'reinaldojesus.g@gmail.com' LIMIT 1`
  if (!users.length) {
    console.error("❌ Usuario no encontrado. Asegúrate de haberte registrado primero.")
    process.exit(1)
  }
  const userId = users[0].id
  console.log(`✅ Usuario encontrado: ${users[0].email} (${userId})`)

  // Limpiar datos previos de prueba
  console.log("🧹 Limpiando transacciones y cuentas previas...")
  await sql`DELETE FROM "transactions" WHERE "userId" = ${userId}`
  await sql`DELETE FROM "fin_accounts" WHERE "userId" = ${userId}`
  await sql`DELETE FROM "categories" WHERE "userId" = ${userId}`

  // Crear categorías
  console.log("📂 Creando categorías...")
  const categoryDefs = [
    { name: "Sueldo", type: "INCOME", color: "#10b981", icon: "💼" },
    { name: "Freelance", type: "INCOME", color: "#3b82f6", icon: "💻" },
    { name: "Otros ingresos", type: "INCOME", color: "#06b6d4", icon: "💰" },
    { name: "Alimentación", type: "EXPENSE", color: "#f97316", icon: "🍔" },
    { name: "Transporte", type: "EXPENSE", color: "#eab308", icon: "🚗" },
    { name: "Vivienda", type: "EXPENSE", color: "#ef4444", icon: "🏠" },
    { name: "Salud", type: "EXPENSE", color: "#ec4899", icon: "🏥" },
    { name: "Entretenimiento", type: "EXPENSE", color: "#a855f7", icon: "🎮" },
    { name: "Ropa", type: "EXPENSE", color: "#f43f5e", icon: "👕" },
    { name: "Educación", type: "EXPENSE", color: "#14b8a6", icon: "📚" },
    { name: "Otros gastos", type: "EXPENSE", color: "#6b7280", icon: "📦" },
  ]

  const categoryMap: Record<string, string> = {}
  for (const cat of categoryDefs) {
    const id = cuid()
    await sql`
      INSERT INTO "categories" (id, name, type, color, icon, "isDefault", "userId", "createdAt")
      VALUES (${id}, ${cat.name}, ${cat.type}, ${cat.color}, ${cat.icon}, true, ${userId}, NOW())
    `
    categoryMap[cat.name] = id
  }
  console.log(`✅ ${categoryDefs.length} categorías creadas`)

  // ─── Cuentas ─────────────────────────────────────────────────────────────

  const accounts: Record<string, string> = {}

  async function createAccount(name: string, type: string, color: string) {
    const id = cuid()
    await sql`
      INSERT INTO "fin_accounts" (id, name, type, balance, currency, color, "userId", "createdAt", "updatedAt")
      VALUES (${id}, ${name}, ${type}, 0, 'CLP', ${color}, ${userId}, NOW(), NOW())
    `
    accounts[name] = id
    console.log(`🏦 Cuenta creada: ${name}`)
    return id
  }

  await createAccount("Santander Cuenta Corriente", "CHECKING", "#e63946")
  await createAccount("BCI Cuenta Corriente", "CHECKING", "#2196f3")
  await createAccount("BCI Visa TDC Nacional", "CREDIT_CARD", "#9c27b0")
  await createAccount("BCI Visa TDC Internacional", "CREDIT_CARD", "#ff9800")

  // ─── Transacciones ────────────────────────────────────────────────────────

  let totalInserted = 0
  const balances: Record<string, number> = {}
  for (const acc of Object.keys(accounts)) balances[acc] = 0

  async function insertTransaction(
    accountName: string,
    type: "INCOME" | "EXPENSE",
    amount: number,
    description: string,
    date: Date,
    categoryName?: string
  ) {
    if (amount <= 0 || isNaN(amount)) return
    const accountId = accounts[accountName]
    const categoryId = categoryName ? categoryMap[categoryName] : null
    const id = cuid()

    await sql`
      INSERT INTO "transactions" (id, amount, type, description, date, "userId", "accountId", "categoryId", "createdAt", "updatedAt")
      VALUES (${id}, ${amount}, ${type}, ${description}, ${date.toISOString()}, ${userId}, ${accountId}, ${categoryId}, NOW(), NOW())
    `
    balances[accountName] += type === "INCOME" ? amount : -amount
    totalInserted++
  }

  // ─── Santander CC XLSX ───────────────────────────────────────────────────

  console.log("\n📊 Procesando Santander Cuenta Corriente...")
  const santanderDir = path.join(BANKING_PATH, "Cuenta corriente/Santander")
  const santanderFiles = fs.readdirSync(santanderDir).filter(f => f.endsWith(".xlsx")).sort()

  for (const file of santanderFiles) {
    const { year, month } = getYearMonth(file)
    const wb = XLSX.readFile(path.join(santanderDir, file))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]

    const headerIdx = rows.findIndex((r) => r[0] === "FECHA")
    if (headerIdx < 0) continue

    let count = 0
    for (const row of rows.slice(headerIdx + 1)) {
      const fecha = row[0] as string
      if (!fecha || typeof fecha !== "string" || !/^\d{2}\/\d{2}$/.test(fecha)) break

      const desc = String(row[2] ?? "").trim()
      const cargo = parseAmount(row[4])
      const abono = parseAmount(row[5])

      if (abono > 0) {
        const cat = guessCategory(desc)
        const catName = cat === "Sueldo" ? "Sueldo" : cat === "" ? "Otros ingresos" : "Otros ingresos"
        await insertTransaction("Santander Cuenta Corriente", "INCOME", abono, desc, parseSantanderDate(fecha, year), catName)
        count++
      } else if (cargo > 0) {
        const cat = guessCategory(desc)
        const catName = cat || "Otros gastos"
        await insertTransaction("Santander Cuenta Corriente", "EXPENSE", cargo, desc, parseSantanderDate(fecha, year), catName)
        count++
      }
    }
    console.log(`  ${file}: ${count} transacciones`)
  }

  // ─── BCI TDC Nacionales XLS ──────────────────────────────────────────────

  console.log("\n💳 Procesando BCI TDC Nacionales...")
  const bciNacDir = path.join(BANKING_PATH, "TDC/BCI/Nacionales")
  const bciNacFiles = fs.readdirSync(bciNacDir).filter(f => f.endsWith(".xls")).sort()

  for (const file of bciNacFiles) {
    const wb = XLSX.readFile(path.join(bciNacDir, file))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]

    const headerIdx = rows.findIndex((r) => r[0] === "Fecha")
    if (headerIdx < 0) continue

    let count = 0
    for (const row of rows.slice(headerIdx + 1)) {
      const fecha = row[0] as string
      if (!fecha || typeof fecha !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(fecha)) continue

      const desc = String(row[3] ?? "").trim()
      const rawMonto = row[5]
      const monto = typeof rawMonto === "number" ? rawMonto : parseFloat(String(rawMonto ?? "0").replace(/[$,\s]/g, ""))

      if (isNaN(monto) || monto === 0) continue

      if (monto < 0) {
        // Pago de tarjeta → ingreso (reduce deuda)
        await insertTransaction("BCI Visa TDC Nacional", "INCOME", Math.abs(monto), desc, parseBCIDate(fecha), "Otros ingresos")
      } else {
        const cat = guessCategory(desc)
        await insertTransaction("BCI Visa TDC Nacional", "EXPENSE", monto, desc, parseBCIDate(fecha), cat || "Otros gastos")
      }
      count++
    }
    console.log(`  ${file}: ${count} transacciones`)
  }

  // ─── BCI TDC Internacionales XLS ─────────────────────────────────────────

  console.log("\n🌍 Procesando BCI TDC Internacionales (USD)...")
  const bciIntDir = path.join(BANKING_PATH, "TDC/BCI/Internacionales")
  const bciIntFiles = fs.readdirSync(bciIntDir).filter(f => f.endsWith(".xls")).sort()

  for (const file of bciIntFiles) {
    const wb = XLSX.readFile(path.join(bciIntDir, file))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]

    const headerIdx = rows.findIndex((r) => r[0] === "Fecha")
    if (headerIdx < 0) continue

    let count = 0
    for (const row of rows.slice(headerIdx + 1)) {
      const fecha = row[0] as string
      if (!fecha || typeof fecha !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(fecha)) continue

      const desc = String(row[3] ?? "").trim()
      const rawMonto = row[5]
      const montoUSD = typeof rawMonto === "number" ? rawMonto : parseFloat(String(rawMonto ?? "0").replace(/[$,\s]/g, ""))

      if (isNaN(montoUSD) || montoUSD === 0) continue

      // Convertir USD → CLP (aprox 950 CLP/USD)
      const montoCLP = Math.round(Math.abs(montoUSD) * 950)

      if (montoUSD < 0) {
        await insertTransaction("BCI Visa TDC Internacional", "INCOME", montoCLP, `${desc} (USD ${Math.abs(montoUSD).toFixed(2)})`, parseBCIDate(fecha), "Otros ingresos")
      } else {
        const cat = guessCategory(desc)
        await insertTransaction("BCI Visa TDC Internacional", "EXPENSE", montoCLP, `${desc} (USD ${montoUSD.toFixed(2)})`, parseBCIDate(fecha), cat || "Otros gastos")
      }
      count++
    }
    console.log(`  ${file}: ${count} transacciones`)
  }

  // ─── Actualizar saldos ────────────────────────────────────────────────────

  console.log("\n💰 Actualizando saldos de cuentas...")
  for (const [name, balance] of Object.entries(balances)) {
    const id = accounts[name]
    await sql`UPDATE "fin_accounts" SET balance = ${balance}, "updatedAt" = NOW() WHERE id = ${id}`
    console.log(`  ${name}: ${balance.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}`)
  }

  console.log(`\n✅ Importación completa: ${totalInserted} transacciones cargadas`)
}

main()
  .catch((err) => {
    console.error("❌ Error:", err)
    process.exit(1)
  })
  .finally(() => pool.end())
