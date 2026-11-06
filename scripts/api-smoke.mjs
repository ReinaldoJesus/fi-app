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
console.log("accounts")
const A = (await call("POST", "/api/v1/accounts", { name: "QA Corriente", type: "CHECKING", balance: 100000 })).data
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

// ── Cleanup of what this run created (the test user itself stays) ──────────
for (const id of [A.id, B.id, C.data.id]) await call("DELETE", `/api/v1/accounts/${id}`)
await call("DELETE", `/api/v1/savings-goals/${goal.data.id}`)
await call("DELETE", `/api/v1/subscriptions/${sub.data.id}`)
await call("PATCH", "/api/v1/me", { theme: "system" })
const after = await call("GET", "/api/v1/accounts")
check("cleanup: accounts deleted (cascade)", after.data.length === 0, after.data.length)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
