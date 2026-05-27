import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { logout } from "@/app/actions/auth"
import { getDashboardData } from "@/app/lib/dashboard"
import NewAccountButton from "./components/NewAccountButton"
import NewTransactionButton from "./components/NewTransactionButton"

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate() {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CHECKING: "Cuenta corriente",
  SAVINGS: "Ahorro",
  CREDIT_CARD: "Tarjeta crédito",
  CASH: "Efectivo",
  INVESTMENT: "Inversiones",
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const userId = session.user.id as string
  const { totalBalance, incomeToday, expensesToday, netToday, accounts, recentTransactions, categories } =
    await getDashboardData(userId)

  const firstName = session.user.name?.split(" ")[0] ?? "Usuario"
  const netPositive = netToday >= 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-white">fi-app</span>
          </div>
          <div className="flex items-center gap-3">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                {firstName[0]}
              </div>
            )}
            <span className="text-sm text-gray-300 hidden sm:block">{session.user.name ?? session.user.email}</span>
            <form action={logout}>
              <button type="submit" className="text-xs text-gray-500 hover:text-gray-300 transition">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-white">Hola, {firstName} 👋</h1>
          <p className="text-gray-400 text-sm mt-1 capitalize">{formatDate()}</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Balance total"
            value={formatCLP(totalBalance)}
            icon="💰"
            color="emerald"
            empty={accounts.length === 0}
          />
          <StatCard
            label="Ingresos hoy"
            value={formatCLP(incomeToday)}
            icon="📈"
            color="green"
            empty={incomeToday === 0}
          />
          <StatCard
            label="Gastos hoy"
            value={formatCLP(expensesToday)}
            icon="📉"
            color="red"
            empty={expensesToday === 0}
          />
          <StatCard
            label="Neto hoy"
            value={formatCLP(Math.abs(netToday))}
            prefix={netToday === 0 ? "" : netPositive ? "+" : "-"}
            icon={netPositive ? "✅" : "⚠️"}
            color={netPositive ? "emerald" : "orange"}
            empty={netToday === 0}
          />
        </div>

        {/* Accounts + Transactions */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Accounts */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Mis cuentas</h2>
              <NewAccountButton />
            </div>
            {accounts.length === 0 ? (
              <EmptyState
                icon="🏦"
                text="Aún no tienes cuentas"
                sub="Agrega una para empezar a registrar tus finanzas"
              />
            ) : (
              <ul className="space-y-3">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: account.color }} />
                      <div>
                        <p className="text-sm text-white font-medium">{account.name}</p>
                        <p className="text-xs text-gray-500">{ACCOUNT_TYPE_LABEL[account.type]}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white">{formatCLP(Number(account.balance))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent transactions */}
          <div className="lg:col-span-2 bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Últimas transacciones</h2>
              <NewTransactionButton accounts={accounts} categories={categories} />
            </div>
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon="📋"
                text="Sin transacciones aún"
                sub="Cuando registres ingresos o gastos aparecerán aquí"
              />
            ) : (
              <ul className="space-y-3">
                {recentTransactions.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: tx.category?.color ? `${tx.category.color}20` : "#6366f120" }}
                      >
                        {tx.category?.icon ?? (tx.type === "INCOME" ? "📈" : "📉")}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{tx.description ?? tx.category?.name ?? "Sin descripción"}</p>
                        <p className="text-xs text-gray-500">
                          {tx.account.name} · {new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(tx.date))}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatCLP(Number(tx.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  label, value, prefix = "", icon, color, empty,
}: {
  label: string
  value: string
  prefix?: string
  icon: string
  color: "emerald" | "green" | "red" | "orange"
  empty: boolean
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    green: "bg-green-500/10 text-green-400",
    red: "bg-red-500/10 text-red-400",
    orange: "bg-orange-500/10 text-orange-400",
  }
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <span className={`text-lg w-8 h-8 rounded-xl flex items-center justify-center ${colors[color]}`}>{icon}</span>
      </div>
      <p className={`text-xl font-bold ${empty ? "text-gray-600" : "text-white"}`}>
        {empty ? "—" : `${prefix}${value}`}
      </p>
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div className="py-8 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-medium text-gray-400">{text}</p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  )
}
