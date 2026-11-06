import { auth } from "@/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getAccountStatement } from "@/server/services/accounts"
import PrivateAmount from "@/components/PrivateAmount"
import { fmtCurrency } from "@/lib/fmt"
import ProductIcon from "@/components/ProductIcon"
import { card, ACCOUNT_TYPE_LABEL } from "@/lib/ui"


type TxRow = Awaited<ReturnType<typeof getAccountStatement>>["transactions"][number]

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
  const { account, transactions } = await getAccountStatement(session!.user!.id!, id)

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

  const used = Math.abs(Math.min(0, balance))
  const pct = isCredit && creditLimit ? Math.min(100, Math.round((used / creditLimit) * 100)) : null
  const barColor = pct == null ? "#86868b" : pct >= 80 ? "#ff3b30" : pct >= 50 ? "#ff9500" : "#34c759"
  const totalIn = transactions.reduce((s, t) => s + ((t.type === "INCOME" && t.accountId === id) || (t.type === "TRANSFER" && t.accountId !== id) ? Number(t.amount) : 0), 0)
  const totalOut = transactions.reduce((s, t) => s + ((t.type === "EXPENSE" || t.type === "TRANSFER") && t.accountId === id ? Number(t.amount) : 0), 0)
  const dateFmt = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">

      {/* Back */}
      <Link href="/dashboard/accounts" className="inline-flex items-center gap-1.5 text-[13px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Cuentas y tarjetas
      </Link>

      {/* Account header */}
      <section className="relative overflow-hidden rounded-3xl text-white bg-gradient-to-br from-[#1d1d1f] to-[#2c2c2e] dark:from-[#1c1c1e] dark:to-[#0b0b0c] dark:border dark:border-white/[0.08]">
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: account.color }} />
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl opacity-30" style={{ backgroundColor: account.color }} />
        <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <ProductIcon type={account.type} color={account.color} size={48} />
            <div>
              <p className="text-[11px] font-semibold text-white/55 uppercase tracking-[0.12em]">{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</p>
              <h1 className="text-[22px] font-semibold tracking-tight">{account.name}</h1>
              {cur !== "CLP" && <p className="text-[12px] text-white/50">Moneda: {cur}</p>}
            </div>
          </div>

          {isCredit ? (
            <div className="grid grid-cols-2 gap-3 lg:min-w-[360px]">
              <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] px-4 py-3">
                <p className="text-[10px] text-white/50 uppercase tracking-[0.08em] font-semibold">Utilizado</p>
                <PrivateAmount value={fmt(used)} className="block mt-1 text-[20px] font-semibold tabular-nums text-[#ff453a]" />
              </div>
              <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] px-4 py-3">
                <p className="text-[10px] text-white/50 uppercase tracking-[0.08em] font-semibold">Cupo disponible</p>
                {creditLimit
                  ? <PrivateAmount value={fmt(Math.max(0, creditLimit - used))} className="block mt-1 text-[20px] font-semibold tabular-nums text-[#30d158]" />
                  : <p className="mt-1 text-[13px] text-white/50">Sin cupo definido</p>}
              </div>
              {pct != null && (
                <div className="col-span-2">
                  <div className="h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/50">{pct}% del cupo utilizado</p>
                </div>
              )}
            </div>
          ) : (
            <div className="lg:text-right">
              <p className="text-[11px] font-semibold text-white/55 uppercase tracking-[0.12em]">Saldo disponible</p>
              <PrivateAmount value={fmt(balance)} className={`block mt-1 text-[36px] font-semibold tabular-nums leading-none ${balance < 0 ? "text-[#ff453a]" : ""}`} />
            </div>
          )}
        </div>
      </section>

      {/* Statement totals */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Abonos", value: `+${fmt(totalIn)}`, cls: "text-[#34c759]" },
          { label: "Cargos", value: `−${fmt(totalOut)}`, cls: "text-[#ff3b30]" },
          { label: "Movimientos", value: String(transactions.length), cls: "text-[#1d1d1f] dark:text-white", plain: true },
        ].map(s => (
          <div key={s.label} className={`${card} px-4 py-3.5`}>
            <p className="text-[10px] text-[#86868b] font-semibold uppercase tracking-[0.08em]">{s.label}</p>
            {s.plain
              ? <p className={`mt-1 text-[16px] font-semibold tabular-nums ${s.cls}`}>{s.value}</p>
              : <PrivateAmount value={s.value} className={`block mt-1 text-[16px] font-semibold tabular-nums ${s.cls}`} />}
          </div>
        ))}
      </div>

      {/* Statement */}
      <section className={card}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.05]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">{isCredit ? "Estado de cuenta" : "Cartola de movimientos"}</h2>
            <p className="text-[12px] text-[#86868b]">{transactions.length} registros</p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#86868b]">Sin movimientos en esta cuenta</p>
        ) : (
          <>
            {/* Column headers (desktop) */}
            <div className="hidden md:grid grid-cols-[96px_1fr_120px_120px_130px] gap-3 px-5 py-2.5 bg-[#f5f5f7] dark:bg-white/[0.03] text-[10px] font-semibold text-[#86868b] uppercase tracking-[0.08em]">
              <span>Fecha</span><span>Descripción</span><span className="text-right">Cargos</span><span className="text-right">Abonos</span><span className="text-right">Saldo</span>
            </div>
            {monthGroups.map(([monthLabel, txs]) => (
              <div key={monthLabel}>
                <div className="px-5 py-2 border-y border-black/[0.05] dark:border-white/[0.05] bg-white dark:bg-[#1c1c1e] flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[#1d1d1f] dark:text-white">{monthLabel}</p>
                  <p className="text-[11px] text-[#86868b]">{txs.length} mov.</p>
                </div>
                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {txs.map(t => {
                    const isFrom = t.accountId === id
                    const isTransfer = t.type === "TRANSFER"
                    const isCredit_ = isTransfer ? !isFrom : t.type === "INCOME"
                    const amount = fmt(Number(t.amount))
                    const runningBalance = balanceMap[t.id]
                    const desc = t.description ?? t.category?.name ?? (isTransfer ? "Transferencia" : "Sin descripción")
                    const sub = [
                      t.category?.name,
                      isTransfer ? (isFrom ? `Hacia ${t.toAccount?.name ?? "otra cuenta"}` : `Desde ${t.account.name}`) : null,
                    ].filter(Boolean).join(" · ")

                    return (
                      <div key={t.id}>
                        {/* Desktop row */}
                        <div className="hidden md:grid grid-cols-[96px_1fr_120px_120px_130px] gap-3 items-center px-5 py-3 hover:bg-[#f5f5f7]/70 dark:hover:bg-white/[0.02]">
                          <span className="text-[12px] text-[#6e6e73] dark:text-[#8e8e93] tabular-nums">{dateFmt.format(new Date(t.date))}</span>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] flex-shrink-0"
                              style={{ backgroundColor: t.category?.color ? `${t.category.color}1f` : isTransfer ? "#007aff1f" : "#86868b1f" }}>
                              {t.category?.icon ?? (t.type === "INCOME" ? "↑" : isTransfer ? "⇄" : "↓")}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{desc}</p>
                              {sub && <p className="text-[11px] text-[#86868b] truncate">{sub}</p>}
                            </div>
                          </div>
                          <span className="text-right">
                            {!isCredit_ && <PrivateAmount value={amount} className="text-[13px] font-semibold tabular-nums text-[#1d1d1f] dark:text-white" />}
                          </span>
                          <span className="text-right">
                            {isCredit_ && <PrivateAmount value={amount} className="text-[13px] font-semibold tabular-nums text-[#34c759]" />}
                          </span>
                          <span className="text-right">
                            {runningBalance !== undefined && <PrivateAmount value={fmt(runningBalance)} className="text-[12px] tabular-nums text-[#6e6e73] dark:text-[#8e8e93]" />}
                          </span>
                        </div>
                        {/* Mobile row */}
                        <div className="md:hidden flex items-center gap-3 px-5 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{desc}</p>
                            <p className="text-[11px] text-[#86868b] truncate">{dateFmt.format(new Date(t.date))}{sub && ` · ${sub}`}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <PrivateAmount value={`${isCredit_ ? "+" : "−"}${amount}`}
                              className={`block text-[13px] font-semibold tabular-nums ${isCredit_ ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"}`} />
                            {runningBalance !== undefined && <PrivateAmount value={fmt(runningBalance)} className="block text-[10px] tabular-nums text-[#86868b]" />}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  )
}
