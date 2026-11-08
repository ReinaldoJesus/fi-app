import { auth } from "@/auth"
import Link from "next/link"
import { listAccounts } from "@/server/services/accounts"
import { getUserCountry } from "@/server/services/profile"
import NewAccountButton from "../components/NewAccountButton"
import NewTransferButton from "../components/NewTransferButton"
import AccountDeleteButton from "./AccountDeleteButton"
import ReconcileButton from "./ReconcileButton"
import PrivateAmount from "@/components/PrivateAmount"
import ProductIcon from "@/components/ProductIcon"
import { fmtCurrency } from "@/lib/fmt"
import { card, eyebrow, sectionTitle, ACCOUNT_TYPE_LABEL } from "@/lib/ui"

type Acc = Awaited<ReturnType<typeof listAccounts>>[number]

function CreditCardVisual({ c }: { c: Acc }) {
  const cur = c.currency ?? "CLP"
  const used = Math.abs(Math.min(0, Number(c.balance)))
  const limit = Number(c.creditLimit) || 0
  return (
    <Link href={`/dashboard/accounts/${c.id}`}
      className="relative block aspect-[1.586] w-full max-w-[320px] rounded-2xl p-5 text-white overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 transition-transform"
      style={{ background: `linear-gradient(135deg, ${c.color} 0%, ${c.color}d9 40%, #1d1d1f 120%)` }}>
      <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -right-2 top-16 w-32 h-32 rounded-full bg-white/[0.06]" />
      <div className="relative h-full flex flex-col">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">{c.bank ?? "Clarifi"}</p>
            <p className="text-[15px] font-semibold leading-tight mt-0.5">{c.name}</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/70">Crédito</span>
        </div>
        {/* Chip */}
        <div className="mt-4 w-10 h-7 rounded-md bg-gradient-to-br from-[#f5d77a] to-[#c9a227] opacity-90 grid grid-cols-3 gap-px p-1">
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className="rounded-[1px] bg-black/15" />)}
        </div>
        <div className="mt-auto flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/60 font-semibold">Utilizado</p>
            <PrivateAmount value={fmtCurrency(used, cur)} className="text-[17px] font-semibold tabular-nums" />
          </div>
          {limit > 0 && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.1em] text-white/60 font-semibold">Cupo total</p>
              <PrivateAmount value={fmtCurrency(limit, cur)} className="text-[12px] font-semibold tabular-nums text-white/85" />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default async function AccountsPage() {
  const session = await auth()
  const [accounts, country] = await Promise.all([listAccounts(session!.user!.id as string), getUserCountry(session!.user!.id as string)])

  const regularAll = accounts.filter(a => a.type !== "CREDIT_CARD")
  const cards = accounts.filter(a => a.type === "CREDIT_CARD")

  const groups: Record<string, Acc[]> = {}
  for (const acc of regularAll) {
    const key = acc.bank ?? "Otros"
    ;(groups[key] ??= []).push(acc)
  }

  // Totals by currency
  const cashByCurrency: Record<string, number> = {}
  const debtByCurrency: Record<string, number> = {}
  for (const a of accounts) {
    const cur = a.currency ?? "CLP"
    if (a.type === "CHECKING" || a.type === "SAVINGS") {
      cashByCurrency[cur] = (cashByCurrency[cur] ?? 0) + Number(a.balance)
    } else if (a.type === "CREDIT_CARD") {
      debtByCurrency[cur] = (debtByCurrency[cur] ?? 0) + Math.abs(Math.min(0, Number(a.balance)))
    }
  }
  const cashEntries = Object.entries(cashByCurrency)
  const debtEntries = Object.entries(debtByCurrency)

  const transferAccounts = accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: Number(a.balance) }))

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={eyebrow}>Mis productos</p>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Cuentas y tarjetas</h1>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 1 && <NewTransferButton accounts={transferAccounts} />}
          <NewAccountButton country={country} />
        </div>
      </div>

      {/* Summary */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d1d1f] to-[#2c2c2e] dark:from-[#1c1c1e] dark:to-[#0b0b0c] dark:border dark:border-white/[0.08] text-white">
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[#007aff]/25 blur-3xl" />
        <div className="relative grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
          <div className="p-6">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.12em]">Saldo en cuentas</p>
            {cashEntries.length === 0
              ? <PrivateAmount value={fmtCurrency(0)} className="block mt-2 text-[26px] font-semibold tabular-nums" />
              : cashEntries.map(([cur, amt]) => (
                <PrivateAmount key={cur} value={fmtCurrency(amt, cur)} className="block mt-2 text-[26px] font-semibold tabular-nums leading-tight" />
              ))}
          </div>
          <div className="p-6">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.12em]">Deuda en tarjetas</p>
            {debtEntries.length === 0
              ? <PrivateAmount value={fmtCurrency(0)} className="block mt-2 text-[26px] font-semibold tabular-nums text-[#ff453a]" />
              : debtEntries.map(([cur, amt]) => (
                <PrivateAmount key={cur} value={amt > 0 ? `−${fmtCurrency(amt, cur)}` : fmtCurrency(0, cur)} className="block mt-2 text-[26px] font-semibold tabular-nums text-[#ff453a] leading-tight" />
              ))}
          </div>
          <div className="p-6">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.12em]">Productos</p>
            <p className="mt-2 text-[26px] font-semibold tabular-nums leading-tight">{accounts.length}</p>
            <p className="text-[12px] text-white/45">{regularAll.length} cuentas · {cards.length} tarjetas</p>
          </div>
        </div>
      </section>

      {accounts.length === 0 && (
        <div className={`${card} px-6 py-12 text-center`}>
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Aún no tienes productos</p>
          <p className="text-[13px] text-[#86868b] mt-1">Agrega tu cuenta corriente, de ahorro, tarjeta o efectivo.</p>
        </div>
      )}

      {/* Accounts grouped by bank */}
      {Object.entries(groups).map(([bank, bankAccounts]) => {
        const bankCurrencies = [...new Set(bankAccounts.map(a => a.currency ?? "CLP"))]
        const bankTotal = bankAccounts.reduce((s, a) => s + Number(a.balance), 0)
        return (
          <section key={bank} className={card}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] flex items-center justify-center text-[13px] font-bold">
                  {bank.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className={sectionTitle}>{bank}</h2>
                  <p className="text-[12px] text-[#86868b]">{bankAccounts.length} {bankAccounts.length === 1 ? "cuenta" : "cuentas"}</p>
                </div>
              </div>
              {bankCurrencies.length === 1 && (
                <div className="text-right">
                  <p className={eyebrow}>Total</p>
                  <PrivateAmount value={fmtCurrency(bankTotal, bankCurrencies[0])} className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
                </div>
              )}
            </div>
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {bankAccounts.map(acc => {
                const cur = acc.currency ?? "CLP"
                const bal = Number(acc.balance)
                return (
                  <div key={acc.id} className="flex items-center gap-3 px-5 py-3.5">
                    <Link href={`/dashboard/accounts/${acc.id}`} className="flex items-center gap-3.5 flex-1 min-w-0 group">
                      <ProductIcon type={acc.type} color={acc.color} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white truncate group-hover:text-[#007aff] transition-colors">{acc.name}</p>
                        <p className="text-[12px] text-[#86868b] truncate">
                          {ACCOUNT_TYPE_LABEL[acc.type]}{cur !== "CLP" && <> · <span className="font-medium text-[#007aff]">{cur}</span></>} · {acc._count.transactions} mov.
                        </p>
                      </div>
                    </Link>
                    {/* Balance with its actions underneath, so on narrow phones the name keeps its room. */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <PrivateAmount value={fmtCurrency(bal, cur)} className={`whitespace-nowrap text-[clamp(13px,4vw,15px)] font-semibold tabular-nums ${bal < 0 ? "text-[#ff3b30]" : "text-[#1d1d1f] dark:text-white"}`} />
                      <div className="flex items-center gap-0.5 -mr-1.5 mt-0.5">
                        <ReconcileButton accountId={acc.id} currentBalance={bal} />
                        <AccountDeleteButton accountId={acc.id} accountName={acc.name} txCount={acc._count.transactions} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Credit cards */}
      {cards.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className={eyebrow}>Crédito</p>
            <h2 className={sectionTitle}>Tarjetas de crédito</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cards.map(c => {
              const cur = c.currency ?? "CLP"
              const used = Math.abs(Math.min(0, Number(c.balance)))
              const limit = Number(c.creditLimit) || 0
              const available = limit > 0 ? limit - used : null
              const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null
              const barColor = pct == null ? "#86868b" : pct >= 80 ? "#ff3b30" : pct >= 50 ? "#ff9500" : "#34c759"
              return (
                <div key={c.id} className={`${card} p-5 space-y-4`}>
                  <CreditCardVisual c={c} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#f5f5f7] dark:bg-black/30 rounded-xl px-3.5 py-2.5">
                      <p className="text-[10px] text-[#86868b] font-semibold uppercase tracking-wide">Utilizado</p>
                      <PrivateAmount value={fmtCurrency(used, cur)} className="text-[14px] font-semibold text-[#ff3b30] tabular-nums" />
                    </div>
                    <div className="bg-[#f5f5f7] dark:bg-black/30 rounded-xl px-3.5 py-2.5">
                      <p className="text-[10px] text-[#86868b] font-semibold uppercase tracking-wide">Cupo disponible</p>
                      {available != null
                        ? <PrivateAmount value={fmtCurrency(available, cur)} className="text-[14px] font-semibold text-[#34c759] tabular-nums" />
                        : <p className="text-[13px] text-[#86868b]">Sin cupo definido</p>}
                    </div>
                  </div>
                  {pct != null && (
                    <div>
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-[#86868b]">Uso del cupo</span>
                        <span className="font-semibold tabular-nums" style={{ color: barColor }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Link href={`/dashboard/accounts/${c.id}`} className="text-[13px] text-[#007aff] font-medium hover:opacity-70">
                      Ver estado de cuenta →
                    </Link>
                    <div className="flex items-center gap-1">
                      <ReconcileButton accountId={c.id} currentBalance={-Math.abs(Number(c.balance))} />
                      <AccountDeleteButton accountId={c.id} accountName={c.name} txCount={c._count.transactions} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
