import { auth } from "@/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getAccountTransactionsData } from "@/app/lib/dashboard"
import PrivateAmount from "@/components/PrivateAmount"
import { fmtCurrency } from "@/lib/fmt"

const TYPE_LABEL: Record<string, string> = {
  CHECKING: "Cuenta corriente", SAVINGS: "Cuenta de ahorro",
  CREDIT_CARD: "Tarjeta de crédito", CASH: "Efectivo", INVESTMENT: "Inversiones",
}

type TxRow = Awaited<ReturnType<typeof getAccountTransactionsData>>["transactions"][number]

function groupByMonth(txs: TxRow[]) {
  const groups: [string, TxRow[]][] = []
  const map: Record<string, TxRow[]> = {}
  for (const tx of txs) {
    const d = new Date(tx.date)
    const key = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(d)
    const label = key.charAt(0).toUpperCase() + key.slice(1)
    if (!map[label]) { map[label] = []; groups.push([label, map[label]]) }
    map[label].push(tx)
  }
  return groups
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const { id } = await params
  const { account, transactions } = await getAccountTransactionsData(session!.user!.id!, id)

  if (!account) notFound()

  const isCredit = account.type === "CREDIT_CARD"
  const balance = Number(account.balance)
  const creditLimit = account.creditLimit ? Number(account.creditLimit) : null
  const cur = account.currency ?? "CLP"
  const fmt = (n: number) => fmtCurrency(n, cur)

  // Compute running balance: walk newest→oldest, back-computing what balance was BEFORE each tx
  let running = balance
  const balanceMap: Record<string, number> = {}
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    balanceMap[tx.id] = running
    if (tx.accountId === id) {
      if (tx.type === "INCOME") running -= Number(tx.amount)
      else if (tx.type === "EXPENSE") running += Number(tx.amount)
      else if (tx.type === "TRANSFER") running += Number(tx.amount)
    } else {
      // This account is the toAccount of an incoming transfer
      running -= Number(tx.amount)
    }
  }

  const monthGroups = groupByMonth(transactions)

  const card = "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"

  return (
    <div className="max-w-2xl mx-auto px-5 lg:px-10 py-10 space-y-6">

      {/* Back */}
      <Link href="/dashboard/accounts" className="inline-flex items-center gap-1.5 text-[13px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Cuentas
      </Link>

      {/* Account header */}
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${account.color}20` }}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: account.color }} />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white">{account.name}</h1>
            <p className="text-[12px] text-[#86868b]">{TYPE_LABEL[account.type] ?? account.type}</p>
          </div>
        </div>

        {isCredit ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f5f5f7] dark:bg-black/30 rounded-xl px-4 py-3">
              <p className="text-[10px] text-[#86868b] font-medium uppercase tracking-wide mb-1">Utilizado</p>
              <PrivateAmount value={fmt(Math.abs(balance))} className="text-[18px] font-semibold text-[#ff3b30] tabular-nums" />
            </div>
            {creditLimit && (
              <div className="bg-[#f5f5f7] dark:bg-black/30 rounded-xl px-4 py-3">
                <p className="text-[10px] text-[#86868b] font-medium uppercase tracking-wide mb-1">Disponible</p>
                <PrivateAmount value={fmt(Math.max(0, creditLimit - Math.abs(balance)))} className="text-[18px] font-semibold text-[#34c759] tabular-nums" />
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Saldo actual</p>
            <PrivateAmount value={fmt(balance)} className="text-[28px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
          </div>
        )}
      </div>

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Movimientos</p>
          <p className="text-[12px] text-[#86868b]">{transactions.length} registros</p>
        </div>

        {transactions.length === 0 ? (
          <div className={`${card} px-5 py-12 text-center`}>
            <p className="text-[#86868b] text-sm">Sin movimientos en esta cuenta</p>
          </div>
        ) : (
          <div className="space-y-5">
            {monthGroups.map(([monthLabel, txs]) => (
              <div key={monthLabel}>
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">{monthLabel}</p>
                  <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
                  <p className="text-[11px] text-[#86868b] tabular-nums">
                    {(() => {
                      const inc = txs.filter(t => t.type === "INCOME" && t.accountId === id).reduce((s, t) => s + Number(t.amount), 0)
                      const exp = txs.filter(t => t.type === "EXPENSE" && t.accountId === id).reduce((s, t) => s + Number(t.amount), 0)
                      if (inc > 0 && exp > 0) return `+${fmt(inc)} / −${fmt(exp)}`
                      if (inc > 0) return `+${fmt(inc)}`
                      return `−${fmt(exp)}`
                    })()}
                  </p>
                </div>
                <div className={`${card} divide-y divide-black/[0.06] dark:divide-white/[0.05]`}>
                  {txs.map(t => {
                    const isFrom = t.accountId === id
                    const isTransfer = t.type === "TRANSFER"
                    const sign = isTransfer ? (isFrom ? "−" : "+") : t.type === "INCOME" ? "+" : "−"
                    const amtColor = isTransfer
                      ? (isFrom ? "text-[#ff9500]" : "text-[#007aff]")
                      : t.type === "INCOME" ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"
                    const runningBalance = balanceMap[t.id]

                    return (
                      <div key={t.id} className="flex items-center gap-3.5 px-4 py-3.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0"
                          style={{ backgroundColor: t.category?.color ? `${t.category.color}18` : "#f5f5f7" }}>
                          {t.category?.icon ?? (t.type === "INCOME" ? "↑" : isTransfer ? "⇄" : "↓")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                            {t.description ?? t.category?.name ?? (isTransfer ? "Transferencia" : "Sin descripción")}
                          </p>
                          <p className="text-[11px] text-[#86868b] mt-0.5">
                            {new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(t.date))}
                            {t.category && <> · {t.category.name}</>}
                            {isTransfer && (isFrom ? ` → ${t.toAccount?.name}` : ` ← ${t.account.name}`)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-[13px] font-semibold tabular-nums ${amtColor}`}>
                            {sign}{fmt(Number(t.amount))}
                          </p>
                          {runningBalance !== undefined && (
                            <p className="text-[10px] text-[#86868b] tabular-nums mt-0.5">{fmt(runningBalance)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
