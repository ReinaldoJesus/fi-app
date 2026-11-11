// End-to-end smoke test of /api/v1 against a running dev server.
// Usage: npm run test:api [-- baseUrl]   (default http://localhost:3001)
// Reads TEST_USER_EMAIL / TEST_USER_PASSWORD from .env.local; registers that user if needed.
import fs from "node:fs"

const BASE = process.argv[2] ?? "http://localhost:3001"
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => /^TEST_USER_/.test(l)).map(l => l.split(/=(.*)/s).slice(0, 2)),
)
const EMAIL = env.TEST_USER_EMAIL, PASSWORD = env.TEST_USER_PASSWORD
if (!EMAIL || !PASSWORD) throw new Error("Missing TEST_USER_EMAIL/TEST_USER_PASSWORD in .env.local")

// A local server must use the dev database: these tests create and delete data.
// (Pass ALLOW_PROD_DB=1 to override on purpose.)
if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE) && !process.env.ALLOW_PROD_DB) {
  const raw = fs.readFileSync(".env.local", "utf8")
  const get = k => raw.match(new RegExp(`^${k}=["']?([^"'\\r\\n]+)`, "m"))?.[1]
  const host = u => { try { return new URL(u).hostname.replace("-pooler", "") } catch { return "" } }
  if (get("PROD_DB_HOST") && host(get("DATABASE_URL")) === get("PROD_DB_HOST")) {
    console.error("✗ .env.local apunta a la base de PRODUCCIÓN: las pruebas no corren ahí. Usa la rama dev de Neon (npm run db:dev).")
    process.exit(1)
  }
}

const jar = new Map()
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";")
    const i = pair.indexOf("=")
    jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ")

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie: cookieHeader(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  })
  storeCookies(res)
  const json = await res.json().catch(() => null)
  return { status: res.status, ...json }
}

let passed = 0, failed = 0
function check(name, cond, extra) {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : "") }
}
const balanceOf = async id => (await call("GET", `/api/v1/accounts/${id}`)).data.balance

// ── Session ─────────────────────────────────────────────────────────────────
console.log("auth")
const reg = await call("POST", "/api/v1/auth/register", { name: "QA API", email: EMAIL, password: PASSWORD })
check("register (201 new / 409 existing)", reg.status === 201 || reg.status === 409, reg)
const dup = await call("POST", "/api/v1/auth/register", { name: "QA API", email: EMAIL, password: PASSWORD })
check("duplicate email → 409", dup.status === 409 && dup.error.fields?.email, dup)

const csrf = await fetch(`${BASE}/api/auth/csrf`)
storeCookies(csrf)
const { csrfToken } = await csrf.json()
const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
  body: new URLSearchParams({ email: EMAIL, password: PASSWORD, csrfToken, callbackUrl: `${BASE}/dashboard` }),
  redirect: "manual",
})
storeCookies(login)
const me = await call("GET", "/api/v1/me")
check("login + GET /me", me.status === 200 && me.data.email === EMAIL, me)

// ── Accounts ────────────────────────────────────────────────────────────────
// A run cut short (network, Ctrl+C) leaves its accounts behind; they would steal
// card matches and turn this run's payments into "already recorded". Start clean.
for (const stale of (await call("GET", "/api/v1/accounts")).data ?? []) await call("DELETE", `/api/v1/accounts/${stale.id}`)

console.log("accounts")
const A =(await call("POST", "/api/v1/accounts", { name: "QA Corriente", type: "CHECKING", balance: 100000 })).data
const B = (await call("POST", "/api/v1/accounts", { name: "QA Ahorro", type: "SAVINGS", balance: "0" })).data
const C = await call("POST", "/api/v1/accounts", { name: "QA Visa", type: "CREDIT_CARD", creditLimit: "500000", usedAmount: "120000", color: "#007aff" })
check("create accounts (JSON + form strings)", A?.balance === 100000 && B?.balance === 0, { A, B })
check("credit card used → negative balance", C.status === 201 && C.data.balance === -120000 && C.data.creditLimit === 500000, C)
const bad = await call("POST", "/api/v1/accounts", { name: "", type: "NOPE" })
check("invalid account → 422 with fields", bad.status === 422 && bad.error.fields?.name && bad.error.fields?.type, bad)
const ghost = await call("GET", "/api/v1/accounts/not-mine-123")
check("unknown account → 404", ghost.status === 404, ghost)

// ── Transactions & balances ─────────────────────────────────────────────────
console.log("transactions")
const cats = (await call("GET", "/api/v1/categories?type=EXPENSE")).data
check("default categories created", cats.length >= 8, cats.length)
const food = cats[0]
const incomeCat = (await call("GET", "/api/v1/categories?type=INCOME")).data[0]

const t1 = await call("POST", "/api/v1/transactions", { type: "EXPENSE", amount: 20000, accountId: A.id, categoryId: food.id, date: "2026-11-06" })
check("expense created", t1.status === 201, t1)
check("calendar date stored at noon UTC", t1.data?.date === "2026-11-06T12:00:00.000Z", t1.data?.date)
check("expense lowers balance (100000 → 80000)", (await balanceOf(A.id)) === 80000)

const wrongCat = await call("POST", "/api/v1/transactions", { type: "INCOME", amount: 1, accountId: A.id, categoryId: food.id })
check("income with expense category → 400", wrongCat.status === 400, wrongCat)
const neg = await call("POST", "/api/v1/transactions", { type: "EXPENSE", amount: -5, accountId: A.id })
check("negative amount → 422", neg.status === 422 && neg.error.fields?.amount, neg)
const foreign = await call("POST", "/api/v1/transactions", { type: "EXPENSE", amount: 5, accountId: "someone-elses-account" })
check("someone else's account → 404", foreign.status === 404, foreign)

const moved = await call("PATCH", `/api/v1/transactions/${t1.data.id}`, { accountId: B.id, amount: 5000 })
check("edit: move to another account + new amount", moved.status === 200, moved)
check("…old account restored (80000 → 100000)", (await balanceOf(A.id)) === 100000)
check("…new account charged (0 → -5000)", (await balanceOf(B.id)) === -5000)

const flipped = await call("PATCH", `/api/v1/transactions/${t1.data.id}`, { type: "INCOME", categoryId: incomeCat.id })
check("edit: expense → income", flipped.status === 200 && flipped.data.type === "INCOME", flipped)
check("…balance flips (-5000 → +5000)", (await balanceOf(B.id)) === 5000)

const tr = await call("POST", "/api/v1/transfers", { fromAccountId: A.id, toAccountId: B.id, amount: "30000" })
check("transfer created", tr.status === 201, tr)
check("…origin debited (100000 → 70000)", (await balanceOf(A.id)) === 70000)
check("…destination credited (5000 → 35000)", (await balanceOf(B.id)) === 35000)
const same = await call("POST", "/api/v1/transfers", { fromAccountId: A.id, toAccountId: A.id, amount: 1 })
check("transfer to same account → 422", same.status === 422, same)

const trEdit = await call("PATCH", `/api/v1/transactions/${tr.data.id}`, { amount: 10000 })
check("edit transfer amount", trEdit.status === 200, trEdit)
check("…both sides adjusted (A 90000 / B 15000)", (await balanceOf(A.id)) === 90000 && (await balanceOf(B.id)) === 15000)
const trType = await call("PATCH", `/api/v1/transactions/${tr.data.id}`, { type: "EXPENSE" })
check("transfer → expense rejected", trType.status === 400, trType)

const trDel = await call("DELETE", `/api/v1/transactions/${tr.data.id}`)
check("delete transfer", trDel.status === 200, trDel)
check("…both sides reverted (A 100000 / B 5000)", (await balanceOf(A.id)) === 100000 && (await balanceOf(B.id)) === 5000)

const list = await call("GET", `/api/v1/transactions?accountId=${B.id}&limit=1`)
check("list with filter + pagination", list.status === 200 && list.data.items.length === 1 && "nextCursor" in list.data, list)

const imp = await call("POST", "/api/v1/transactions/import", {
  rows: [
    { type: "EXPENSE", amount: 1000, description: "csv 1", date: "2026-10-01", accountId: A.id },
    { type: "INCOME", amount: 3000, description: "csv 2", date: "2026-10-02", accountId: A.id },
  ],
})
check("import 2 rows", imp.status === 201 && imp.data.imported === 2, imp)
check("…net +2000 on account (102000)", (await balanceOf(A.id)) === 102000)

const rec = await call("POST", `/api/v1/accounts/${A.id}/reconcile`, { realBalance: 100500 })
check("reconcile records adjustment", rec.status === 200 && rec.data.delta === -1500 && (await balanceOf(A.id)) === 100500, rec)

// ── Budgets / goals / subscriptions / recurring ─────────────────────────────
console.log("planning")
const bud = await call("PUT", "/api/v1/budgets", { categoryId: food.id, month: 11, year: 2026, amount: 50000 })
check("set budget", bud.status === 200 && bud.data.amount === 50000, bud)
const month = await call("GET", "/api/v1/budgets?month=11&year=2026")
check("budget month shows budget", month.data?.budgetMap?.[food.id] === 50000, month.data?.budgetMap)
const budClear = await call("PUT", "/api/v1/budgets", { categoryId: food.id, month: 11, year: 2026, amount: 0 })
check("budget amount 0 removes it (cleanup)", budClear.status === 200 && budClear.data.amount === 0, budClear)

const goal = await call("POST", "/api/v1/savings-goals", { name: "QA Viaje", targetAmount: 1000, currentAmount: "0" })
check("create goal", goal.status === 201, goal)
const contrib = await call("POST", `/api/v1/savings-goals/${goal.data.id}/contributions`, { amount: 1000 })
check("contribution completes goal", contrib.data?.completed === true && contrib.data.currentAmount === 1000, contrib)

const sub = await call("POST", "/api/v1/subscriptions", { name: "QA Stream", amount: "6990", billingDay: "15" })
check("create subscription", sub.status === 201 && sub.data.billingDay === 15, sub)
const paused = await call("PATCH", `/api/v1/subscriptions/${sub.data.id}`, { active: false })
check("pause subscription", paused.data?.active === false, paused)
const cleared = await call("PATCH", `/api/v1/subscriptions/${sub.data.id}`, { billingDay: "" })
check("clear billing day with empty string", cleared.data?.billingDay === null, cleared)

const r = await call("POST", "/api/v1/recurring", { type: "EXPENSE", amount: 100, accountId: B.id, dayOfMonth: 1, description: "QA recurrente" })
check("create recurring", r.status === 201, r)
const run1 = await call("POST", "/api/v1/recurring/run")
const run2 = await call("POST", "/api/v1/recurring/run")
check("recurring run is idempotent", run1.data?.generated >= 1 && run2.data?.generated === 0, { run1, run2 })

// ── Reports & profile ───────────────────────────────────────────────────────
console.log("reports & profile")
const sum = await call("GET", "/api/v1/reports/summary")
check("summary", sum.status === 200 && typeof sum.data.netBalance === "number" && sum.data.accounts.length === 3, sum.data && { net: sum.data.netBalance })
const an = await call("GET", "/api/v1/reports/analytics?months=3")
check("analytics (3 months)", an.status === 200 && an.data.months.length === 3, an)
const an2 = await call("GET", "/api/v1/reports/analytics?months=99")
check("analytics out of range → 422", an2.status === 422, an2)
const notif = await call("GET", "/api/v1/reports/notifications")
check("notifications", notif.status === 200 && Array.isArray(notif.data.notifications), notif)
const theme = await call("PATCH", "/api/v1/me", { theme: "dark", defaultAccountId: A.id })
check("update preferences", theme.data?.theme === "dark" && theme.data.defaultAccountId === A.id, theme)
const pw = await call("POST", "/api/v1/me/password", { currentPassword: "wrong-password", newPassword: "whatever123" })
check("wrong current password → 400", pw.status === 400, pw)
const badJson = await fetch(`${BASE}/api/v1/accounts`, { method: "POST", headers: { cookie: cookieHeader(), "content-type": "application/json" }, body: "{oops" })
check("malformed JSON → 400", badJson.status === 400)

// ── Pilot features ──────────────────────────────────────────────────────────
console.log("password reset")
const rr1 = await call("POST", "/api/v1/auth/password-reset", { email: `nadie-${Date.now()}@example.test` })
check("reset request for unknown email → 202 (no account enumeration)", rr1.status === 202 && rr1.data?.sent === true, rr1)
const rr2 = await call("GET", "/api/v1/auth/password-reset?token=" + "x".repeat(43))
check("reset link check: invalid token → valid false", rr2.status === 200 && rr2.data?.valid === false, rr2)
const rr3 = await call("POST", "/api/v1/auth/password-reset/confirm", { token: "x".repeat(43), password: "Nueva12345" })
check("reset confirm with bad token → 400", rr3.status === 400 && rr3.error?.code === "invalid_token", rr3)
const rr4 = await call("POST", "/api/v1/auth/password-reset/confirm", { token: "x".repeat(43), password: "corta" })
check("reset confirm with weak password → 422", rr4.status === 422 && rr4.error?.fields?.password, rr4)

console.log("statement import")
const csv = "Banco QA\nFecha;Detalle;Cargos;Abonos;Saldo\n01/10/2026;Saldo inicial;;;1000\n02/10/2026;QA Supermercado;12.990;;\n03/10/2026;QA Sueldo;;1.500.000;\n03/10/2026;QA Supermercado;12.990;;\n"
const form = new FormData()
form.set("file", new Blob([csv], { type: "text/csv" }), "cartola.csv")
form.set("accountId", A.id)
const prevRes = await fetch(`${BASE}/api/v1/transactions/import/preview`, { method: "POST", headers: { cookie: cookieHeader() }, body: form })
const prev = { status: prevRes.status, ...(await prevRes.json()) }
check("statement preview parses rows, skips saldo",
  prev.status === 200 && prev.data.rows.length === 3 && prev.data.skipped === 1
  && prev.data.rows[0].amount === 12990 && prev.data.rows[1].type === "INCOME" && prev.data.rows[1].amount === 1500000, prev)
await call("POST", "/api/v1/transactions/import", { rows: [{ type: "EXPENSE", amount: 12990, date: "2026-10-02", accountId: A.id, description: "QA ya cargado" }] })
const prevRes2 = await fetch(`${BASE}/api/v1/transactions/import/preview`, { method: "POST", headers: { cookie: cookieHeader() }, body: form })
const prev2 = await prevRes2.json()
check("statement preview flags movements already in the account", prev2.data?.duplicates === 1 && prev2.data.rows[0].duplicate === true && prev2.data.rows[2].duplicate === false, prev2)
const badForm = new FormData()
badForm.set("file", new Blob(["hola"], { type: "application/pdf" }), "cartola.pdf")
const badPrev = await fetch(`${BASE}/api/v1/transactions/import/preview`, { method: "POST", headers: { cookie: cookieHeader() }, body: badForm })
check("statement preview rejects unsupported formats → 400", badPrev.status === 400)

console.log("receipts")
// Smallest valid PNG (1×1).
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")
const rf = new FormData()
rf.set("file", new Blob([png], { type: "image/png" }), "boleta.png")
const up = await fetch(`${BASE}/api/v1/transactions/${t1.data.id}/receipt`, { method: "PUT", headers: { cookie: cookieHeader() }, body: rf })
check("upload receipt", up.status === 200)
const img = await fetch(`${BASE}/api/v1/transactions/${t1.data.id}/receipt`, { headers: { cookie: cookieHeader() } })
check("download receipt (sniffed as PNG)", img.status === 200 && img.headers.get("content-type") === "image/png")
const withReceipt = await call("GET", `/api/v1/transactions/${t1.data.id}`)
check("transaction reports hasReceipt", withReceipt.data?.hasReceipt === true, withReceipt)
const fake = new FormData()
fake.set("file", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "boleta.png")
const upFake = await fetch(`${BASE}/api/v1/transactions/${t1.data.id}/receipt`, { method: "PUT", headers: { cookie: cookieHeader() }, body: fake })
check("non-image disguised as PNG → 400", upFake.status === 400)
const rmR = await call("DELETE", `/api/v1/transactions/${t1.data.id}/receipt`)
check("delete receipt", rmR.status === 200, rmR)

console.log("push, errors, export")
const ps = await call("GET", "/api/v1/push-subscriptions")
check("push status", ps.status === 200 && typeof ps.data.configured === "boolean" && Array.isArray(ps.data.devices), ps)
const badSub = await call("POST", "/api/v1/push-subscriptions", { endpoint: "not-a-url", keys: { p256dh: "x", auth: "y" } })
check("invalid push subscription → 422", badSub.status === 422, badSub)
const erRes = await fetch(`${BASE}/api/v1/errors`, {
  method: "POST",
  headers: { cookie: cookieHeader(), "content-type": "application/json", "x-clarifi-test": "1" },
  body: JSON.stringify({ message: "QA smoke test: reporte de error de prueba", path: "/qa" }),
})
const er = { status: erRes.status, ...(await erRes.json()) }
check("client error report → 202", er.status === 202, er)
const job = await fetch(`${BASE}/api/v1/jobs/daily`)
check("daily job without CRON_SECRET → 401", job.status === 401)
const exp = await fetch(`${BASE}/api/v1/me/export`, { headers: { cookie: cookieHeader() } })
const expJson = await exp.json()
check("export my data (JSON download, no secrets)",
  exp.status === 200 && /attachment/.test(exp.headers.get("content-disposition") ?? "")
  && expJson.profile?.email === EMAIL && Array.isArray(expJson.transactions) && !JSON.stringify(expJson).includes("password\":"), { status: exp.status })

console.log("account deletion (throwaway user)")
const tmpEmail = `qa-delete-${Date.now()}@clarifi.test`
const tmpJar = new Map()
const tmpCookies = () => [...tmpJar].map(([k, v]) => `${k}=${v}`).join("; ")
const tmpStore = res => { for (const c of res.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); tmpJar.set(p.slice(0, i), p.slice(i + 1)) } }
await call("POST", "/api/v1/auth/register", { name: "QA Borrar", email: tmpEmail, password: "Borrar12345" })
const c2 = await fetch(`${BASE}/api/auth/csrf`); tmpStore(c2)
const { csrfToken: tok2 } = await c2.json()
tmpStore(await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST", redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: tmpCookies() },
  body: new URLSearchParams({ email: tmpEmail, password: "Borrar12345", csrfToken: tok2, callbackUrl: `${BASE}/dashboard` }),
}))
const del = (body) => fetch(`${BASE}/api/v1/me`, { method: "DELETE", headers: { cookie: tmpCookies(), "content-type": "application/json" }, body: JSON.stringify(body) })
const d1 = await del({ confirm: "ELIMINAR", password: "incorrecta" })
check("delete account with wrong password → 400", d1.status === 400)
const d2 = await del({ confirm: "borrar", password: "Borrar12345" })
check("delete account without typing ELIMINAR → 422", d2.status === 422)
const d3 = await del({ confirm: "ELIMINAR", password: "Borrar12345" })
const reReg = await call("POST", "/api/v1/auth/register", { name: "QA Borrar", email: tmpEmail, password: "Borrar12345" })
check("delete account removes the user (email can register again)", d3.status === 200 && reReg.status === 201, { d3: d3.status, reReg: reReg.status })
// Remove the re-registered throwaway user too.
tmpJar.clear()
const c3 = await fetch(`${BASE}/api/auth/csrf`); tmpStore(c3)
const { csrfToken: tok3 } = await c3.json()
tmpStore(await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST", redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: tmpCookies() },
  body: new URLSearchParams({ email: tmpEmail, password: "Borrar12345", csrfToken: tok3, callbackUrl: `${BASE}/dashboard` }),
}))
await del({ confirm: "ELIMINAR", password: "Borrar12345" })

// ── Step-by-step signup: what the person built is saved with the account ──
console.log("signup setup (throwaway user)")
{
  const jar = new Map()
  const st = r => { for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); jar.set(p.slice(0, i), p.slice(i + 1)) } }
  const ck = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ")
  const as = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { cookie: ck(), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, ...(await r.json().catch(() => ({}))) }
  }
  const email = `qa-setup-${Date.now()}@example.test`, password = "QaSetup12345"
  const setup = {
    account: { name: "Cuenta corriente Santander", type: "CHECKING", bank: "Santander", balance: 450000 },
    subscriptions: [{ name: "Netflix", amount: 9990, billingDay: 8 }, { name: "Spotify", amount: 5990 }],
    goal: { name: "Vacaciones", targetAmount: 1000000 },
    budgets: [{ category: "Alimentación", amount: 250000 }, { category: "No existe", amount: 1000 }],
  }
  const reg = await call("POST", "/api/v1/auth/register", { name: "QA Setup", email, password, setup })
  check("register with setup → account, subscriptions, goal and budget", reg.status === 201 && reg.data?.setup?.account && reg.data.setup.subscriptions === 2 && reg.data.setup.goal && reg.data.setup.budgets === 1, reg)
  const c = await fetch(`${BASE}/api/auth/csrf`); st(c)
  const { csrfToken } = await c.json()
  st(await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: ck() }, body: new URLSearchParams({ email, password, csrfToken }) }))
  const accs = await as("GET", "/api/v1/accounts")
  check("setup account has the opening balance", accs.data?.length === 1 && accs.data[0].balance === 450000, accs.data)
  const again = await as("POST", "/api/v1/me/setup", setup)
  const subs = await as("GET", "/api/v1/subscriptions")
  check("setup runs once (409, nothing duplicated)", again.status === 409 && subs.data?.length === 2, { again: again.status, subs: subs.data?.length })
  check("invalid setup → 422", (await as("POST", "/api/v1/me/setup", { subscriptions: [{ name: "", amount: -1 }] })).status === 422)
  check("cleanup: setup user deleted", (await as("DELETE", "/api/v1/me", { confirm: "ELIMINAR", password })).status === 200)
}

// ── Apple Pay via iPhone Shortcuts (personal token) ────────────────────────
console.log("\nshortcuts (personal token)")
{
  const tk = await call("POST", "/api/v1/me/tokens", { name: "QA iPhone" })
  check("create token → shown once (clf_…)", tk.status === 201 && /^clf_/.test(tk.data?.token) && tk.data.prefix === tk.data.token.slice(0, 8), tk)
  const list = await call("GET", "/api/v1/me/tokens")
  check("list tokens never returns the token", list.data?.some(t => t.id === tk.data.id) && list.data.every(t => !("token" in t) && !("tokenHash" in t)), list.data)
  const sc = async (body, { token = tk.data.token, text = false } = {}) => {
    const r = await fetch(`${BASE}/api/v1/shortcuts/transaction${text ? "?format=text" : ""}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    })
    return { status: r.status, body: text ? await r.text() : await r.json().catch(() => ({})) }
  }
  check("no token → 401", (await sc({ amount: "1" }, { token: null })).status === 401)
  check("unknown token → 401", (await sc({ amount: "1" }, { token: "clf_" + "x".repeat(32) })).status === 401)
  const usedBefore = await balanceOf(C.data.id)
  const pay = await sc({ amount: "$12.990", merchant: "QA Café Wallet", card: "QA Visa Crédito" })
  check("payment → card picks the account, Wallet amount parsed", pay.status === 201 && pay.body.data?.account.id === C.data.id && pay.body.data.amount === 12990, pay)
  check("payment moves the card balance", (await balanceOf(C.data.id)) === usedBefore - 12990, { before: usedBefore, after: await balanceOf(C.data.id) })
  await call("POST", "/api/v1/transactions", { type: "EXPENSE", amount: 3000, accountId: A.id, categoryId: food.id, description: "QA Panadería" })
  const known = await sc({ amount: "$2.500", merchant: "qa panaderia", card: "QA Corriente" })
  check("same merchant as before → same category", known.status === 201 && known.body.data?.category?.id === food.id && known.body.data.account.id === A.id, known.body)
  const jumbo = await sc({ amount: "$18.450", merchant: "JUMBO LA REINA", dryRun: true })
  check("known store, no history → category from the store (Jumbo → Alimentación)", jumbo.body.data?.category?.name === "Alimentación", jumbo.body.data?.category)
  const copec = await sc({ amount: "$30.000", merchant: "COPEC LA REINA", dryRun: true })
  check("known store → Copec → Transporte", copec.body.data?.category?.name === "Transporte", copec.body.data?.category)
  const unknown = await sc({ amount: "$5.000", merchant: "QA Tienda Desconocida", dryRun: true })
  check("unknown store → Otros gastos (not a random guess)", unknown.body.data?.category?.name === "Otros gastos", unknown.body.data?.category)
  const transportCat = cats.find(c => c.name === "Transporte")
  await call("POST", "/api/v1/transactions", { type: "EXPENSE", amount: 4000, accountId: A.id, categoryId: transportCat.id, description: "QA Jumbo Delivery" })
  const corrected = await sc({ amount: "$4.000", merchant: "QA Jumbo Delivery", dryRun: true })
  check("their own earlier choice beats the store dictionary", corrected.body.data?.category?.name === "Transporte", corrected.body.data?.category)
  const txt = await sc({ amount: "4.990", merchant: "QA Texto" }, { text: true })
  check("?format=text → message ready for the notification", txt.status === 201 && txt.body.startsWith("✓ Registrado:") && txt.body.includes("QA Texto"), txt)
  const dry = await sc({ amount: "$1.000", merchant: "QA Dry", dryRun: true })
  const dryTx = ((await call("GET", `/api/v1/transactions?accountId=${A.id}&limit=500`)).data?.items ?? []).filter(t => t.description === "QA Dry")
  check("dryRun → nothing saved", dry.status === 201 && dry.body.data?.id === null && dry.body.data.message.startsWith("Así quedaría") && dryTx.length === 0, { dry: dry.body, dryTx })
  const bad = await sc({ amount: "gratis" }, { text: true })
  check("unreadable amount → readable text error", bad.status === 400 && bad.body.startsWith("✗ Clarifi:"), bad)
  const used = (await call("GET", "/api/v1/me/tokens")).data.find(t => t.id === tk.data.id)
  check("token records its last use", !!used?.lastUsedAt, used)
  const personal = await fetch(`${BASE}/api/v1/shortcuts/${tk.data.token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: "$1.500", merchant: "QA URL personal", dryRun: true }) })
  const personalText = await personal.text()
  check("personal URL (token in the path) → plain text, no headers needed", personal.status === 201 && personalText.startsWith("Así quedaría: $1.500"), { status: personal.status, personalText })
  const wrongUrl = await fetch(`${BASE}/api/v1/shortcuts/clf_${"y".repeat(32)}`, { method: "POST", body: "{}" })
  check("personal URL with a wrong token → 401 as readable text", wrongUrl.status === 401 && (await wrongUrl.text()).startsWith("✗ Clarifi:"))
  const android = await sc({ title: "Santander", text: "Compra por $7.450 en QA FARMACIA ANDROID con tu tarjeta de crédito ****1234" })
  check("Android notification → amount, merchant and credit card read from the text", android.status === 201 && android.body.data?.amount === 7450 && android.body.data.account.id === C.data.id && /QA FARMACIA ANDROID/.test(android.body.data.message), android.body)
  check("new merchant with no history → never uncategorised", !!android.body.data?.category?.id, android.body.data?.category)
  const noAmount = await sc({ title: "Google Wallet", text: "Tarjeta agregada" })
  check("notice that is not a movement → 200 ignored, nothing saved", noAmount.status === 200 && noAmount.body.data?.ignored === true, noAmount.body)
  const promo = await sc({ title: "¡Aprovecha!", text: "30% de descuento en tu próxima compra de $50.000 o más" })
  check("promotion → ignored", promo.status === 200 && promo.body.data?.reason === "promoción", promo.body)
  const incoming = await sc({ title: "QA Banco", text: "Recibiste una transferencia de QA CAMILA ROJAS por $61.230", source: "notification" })
  check("transfer received → INCOME 'Transferencia de …' in Otros ingresos", incoming.status === 201 && incoming.body.data?.type === "INCOME" && incoming.body.data.amount === 61230 && /Transferencia de Qa Camila Rojas/.test(incoming.body.data.message) && incoming.body.data.category?.name === "Otros ingresos", incoming.body)
  const salary = await sc({ title: "QA Banco", text: "Abono de remuneraciones por $1.234.567 en tu cuenta", source: "email" })
  check("salary deposit → INCOME in Sueldo", salary.body.data?.type === "INCOME" && salary.body.data.category?.name === "Sueldo", salary.body)
  const pat = await sc({ title: "QA Banco", text: "Se realizó un cargo por $9.991 por PAT NETFLIX", source: "sms" })
  check("automatic charge (PAT Netflix) → EXPENSE by the store dictionary", pat.body.data?.type === "EXPENSE" && pat.body.data.category?.name === "Entretenimiento", pat.body)
  const balBeforeRepeat = await balanceOf(incoming.body.data?.account?.id)
  const again = await sc({ title: "QA Banco", text: "Recibiste una transferencia de QA CAMILA ROJAS por $61.230", source: "email" })
  check("same movement arriving twice (notification + e-mail) → recorded once", again.status === 200 && again.body.data?.duplicate === true && (await balanceOf(incoming.body.data.account.id)) === balBeforeRepeat, again.body)
  check("revoke token",(await call("DELETE", `/api/v1/me/tokens/${tk.data.id}`)).status === 200)
  check("revoked token → 401", (await sc({ amount: "1" })).status === 401)
}

// ── Wallet cards: which account each card goes to ─────────────────────────
console.log("\nwallet cards")
{
  const tk = await call("POST", "/api/v1/me/tokens", { name: "QA cards" })
  const pay = body => fetch(`${BASE}/api/v1/shortcuts/transaction`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tk.data.token}` }, body: JSON.stringify(body),
  }).then(r => r.json())
  const cardId = C.data.id
  // A card name that matches no account: Clarifi has to guess (default / first account).
  const first = await pay({ amount: "$3.100", merchant: "QA Kiosko Uno", card: "QA Tarjeta Misteriosa" })
  const guessed = first.data?.account?.id
  check("unknown card → some account (a guess)", !!guessed && guessed !== cardId, first)
  const cards = await call("GET", "/api/v1/me/cards")
  const mine = cards.data?.find(c => c.card === "QA Tarjeta Misteriosa")
  check("GET /me/cards lists it, not assigned yet, where it went", mine && mine.accountId === null && mine.payments === 1 && mine.current[0][0] === guessed, cards.data)

  const [gBefore, cBefore] = [await balanceOf(guessed), await balanceOf(cardId)]
  const assign = await call("PUT", "/api/v1/me/cards", { card: "QA Tarjeta Misteriosa", accountId: cardId })
  check("assign card → its past payment moves too", assign.status === 200 && assign.data.moved === 1 && assign.data.account.id === cardId, assign)
  check("…and both balances follow", (await balanceOf(guessed)) === gBefore + 3100 && (await balanceOf(cardId)) === cBefore - 3100)
  const next = await pay({ amount: "$2.200", merchant: "QA Kiosko Dos", card: "qa tarjeta  MISTERIOSA" })
  check("next payment with that card (any case/spacing) → the chosen account", next.data?.account?.id === cardId, next)
  check("assign to someone else's account → 404", (await call("PUT", "/api/v1/me/cards", { card: "x", accountId: "not-mine-123" })).status === 404)
  check("assign without a card → 422", (await call("PUT", "/api/v1/me/cards", { card: "", accountId: cardId })).status === 422)

  // Learning: fixing the account of one payment teaches the card.
  const other = await pay({ amount: "$1.300", merchant: "QA Kiosko Tres", card: "QA Otra Tarjeta" })
  check("another unknown card → guessed account", other.data?.account?.id === guessed, other)
  await call("PATCH", `/api/v1/transactions/${other.data.id}`, { accountId: cardId })
  const learned = (await call("GET", "/api/v1/me/cards")).data.find(c => c.card === "QA Otra Tarjeta")
  check("moving one payment by hand teaches the card", learned?.accountId === cardId, learned)
  const after = await pay({ amount: "$1.400", merchant: "QA Kiosko Cuatro", card: "QA Otra Tarjeta" })
  check("…so the next one goes there on its own", after.data?.account?.id === cardId, after)

  const made = [first.data.id, next.data.id, other.data.id, after.data.id]
  await call("POST", "/api/v1/transactions/bulk-delete", { ids: made })
  await call("DELETE", `/api/v1/me/tokens/${tk.data.id}`)
}

// ── WhatsApp bot: link with a code, then "gasté 5 lucas en el uber" ─────────
console.log("\nwhatsapp bot")
{
  const raw = fs.readFileSync(".env.local", "utf8")
  const get = k => raw.match(new RegExp(`^${k}=["']?([^"'\\r\\n]+)`, "m"))?.[1]
  const SECRET = get("WHATSAPP_APP_SECRET"), VERIFY = get("WHATSAPP_VERIFY_TOKEN")
  if (!SECRET || !VERIFY) {
    console.log("  (skipped: no WHATSAPP_APP_SECRET / WHATSAPP_VERIFY_TOKEN in .env.local)")
  } else {
    const crypto = await import("node:crypto")
    const phone = `569${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`
    let n = 0
    // What Meta sends: signed with the app secret.
    const hook = async (message, { sign = true } = {}) => {
      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "qa", changes: [{ field: "messages", value: {
        messaging_product: "whatsapp", messages: [{ from: phone, id: `wamid.qa.${Date.now()}.${n++}`, timestamp: "0", ...message }] } }] }] })
      const headers = { "content-type": "application/json" }
      if (sign) headers["x-hub-signature-256"] = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex")
      const res = await fetch(`${BASE}/api/v1/whatsapp`, { method: "POST", headers, body })
      return { status: res.status, body, json: res.status === 200 ? await res.json() : null }
    }
    const say = async text => (await hook({ type: "text", text: { body: text } })).json?.replies?.[0]?.text ?? ""
    const total = async () => (await call("GET", "/api/v1/accounts")).data.reduce((s, a) => s + Number(a.balance), 0)

    const st = await call("GET", "/api/v1/me/whatsapp")
    check("status → bot enabled, not linked", st.status === 200 && st.data.enabled && !st.data.linked, st)
    const verify = (tok) => fetch(`${BASE}/api/v1/whatsapp?hub.mode=subscribe&hub.verify_token=${tok}&hub.challenge=qa123`)
    const vBad = await verify("wrong"), vOk = await verify(VERIFY)
    check("webhook verification: wrong token 403, right token echoes the challenge", vBad.status === 403 && vOk.status === 200 && (await vOk.text()) === "qa123")
    check("unsigned webhook → 401", (await hook({ type: "text", text: { body: "hola" } }, { sign: false })).status === 401)
    check("unknown number → asks to connect from the app", /no sé de quién/i.test(await say("gasté 5 lucas en el uber")))

    const code = await call("POST", "/api/v1/me/whatsapp")
    check("link code → 6 digits and a wa.me link with it", code.status === 201 && /^\d{6}$/.test(code.data.code) && code.data.url.includes("wa.me/") && decodeURIComponent(code.data.url).includes(code.data.code), code)
    check("sending the code links the number", /Listo/.test(await say(`Hola Clarifi, mi código es ${code.data.code}`)))
    const linked = await call("GET", "/api/v1/me/whatsapp")
    check("status → linked, number masked", linked.data.linked && linked.data.phone.includes("••••") && !linked.data.phone.includes(phone.slice(3, 9)), linked.data)
    check("a code works only once", /no sirve/i.test(await say(`mi código es ${code.data.code}`)))

    const t0 = await total()
    const uber = await say("gasté 5 lucas en el uber")
    check("'gasté 5 lucas en el uber' → $5.000 Uber in Transporte", /Registrado: \$5\.000 en Uber · Transporte/.test(uber), uber)
    check("…and moves the balance", (await total()) === t0 - 5000)
    const undo = await say("borrar")
    check("'borrar' → undoes it and restores the balance", /Borrado: \$5\.000 · Uber/.test(undo) && (await total()) === t0, undo)
    check("'borrar' with nothing left → says so", /nada reciente/i.test(await say("borrar")))

    const salary = await say("me pagaron el sueldo 1.200.000")
    check("'me pagaron el sueldo 1.200.000' → +$1.200.000 in Sueldo", /\+\$1\.200\.000 · Sueldo · Sueldo/.test(salary), salary)
    await say("borrar")
    const two = [await say("2500 café"), await say("2500 café")]
    check("the same thing typed twice is two movements (no dedupe on WhatsApp)", two.every(r => /Registrado/.test(r)), two)
    await say("borrar"); await say("borrar")
    check("balance back to where it started", (await total()) === t0)

    const msg = { type: "text", text: { body: "15k super" } }
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: phone, id: `wamid.qa.repeat.${Date.now()}`, ...msg }] } }] }] })
    const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex")
    const send = () => fetch(`${BASE}/api/v1/whatsapp`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body }).then(r => r.json())
    const first = await send(), second = await send()
    check("Meta re-sending the same message → handled once", first.replies?.length === 1 && second.replies?.length === 0 && /Supermercado|Alimentaci/.test(first.replies[0].text), { first, second })
    await say("borrar")

    check("'saldo' → lists the accounts", /Tus cuentas[\s\S]*QA Corriente/.test(await say("saldo")))
    check("'mes' → month summary", /Gastos:[\s\S]*Ingresos:/.test(await say("mes")))
    check("'hola' → help", /gasté 5 lucas/.test(await say("hola")))
    check("no amount → explains how", /No encontré un monto/.test(await say("qué tal")))
    check("a photo → only text for now", /solo entiendo mensajes de texto/.test((await hook({ type: "image", image: { id: "x" } })).json?.replies?.[0]?.text ?? ""))

    check("unlink", (await call("DELETE", "/api/v1/me/whatsapp")).status === 200)
    check("after unlinking the number is unknown again", /no sé de quién/i.test(await say("5000 uber")))
    check("balance unchanged after all of it", (await total()) === t0)
  }
}

// ── Delete several movements at once (e.g. a whole month) ──────────────────
console.log("\nbulk delete")
{
  const before = await balanceOf(A.id)
  const made = []
  for (const [type, amount] of [["EXPENSE", 1000], ["EXPENSE", 2500], ["INCOME", 700]]) {
    made.push((await call("POST", "/api/v1/transactions", { type, amount, accountId: A.id, categoryId: type === "EXPENSE" ? food.id : incomeCat.id, description: "QA bulk", date: "2026-10-15" })).data.id)
  }
  check("bulk setup moved the balance", (await balanceOf(A.id)) === before - 1000 - 2500 + 700)
  const del = await call("POST", "/api/v1/transactions/bulk-delete", { ids: [...made, "someone-elses-tx"] })
  check("bulk delete → only own movements, count returned", del.status === 200 && del.data?.deleted === 3, del)
  check("bulk delete reverts every balance", (await balanceOf(A.id)) === before, { before, after: await balanceOf(A.id) })
  check("bulk delete with nothing of yours → 404", (await call("POST", "/api/v1/transactions/bulk-delete", { ids: made })).status === 404)
  check("bulk delete with an empty list → 422", (await call("POST", "/api/v1/transactions/bulk-delete", { ids: [] })).status === 422)
}

// ── Cleanup of what this run created (the test user itself stays) ──────────
for (const id of [A.id, B.id, C.data.id]) await call("DELETE", `/api/v1/accounts/${id}`)
await call("DELETE", `/api/v1/savings-goals/${goal.data.id}`)
await call("DELETE", `/api/v1/subscriptions/${sub.data.id}`)
await call("PATCH", "/api/v1/me", { theme: "system" })
const after = await call("GET", "/api/v1/accounts")
check("cleanup: accounts deleted (cascade)", after.data.length === 0, after.data.length)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
