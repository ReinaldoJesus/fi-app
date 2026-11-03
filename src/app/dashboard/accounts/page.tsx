import { auth } from "@/auth"
import Link from "next/link"
import { getAccountsData } from "@/app/lib/dashboard"
import NewAccountButton from "../components/NewAccountButton"
import AccountDeleteButton from "./AccountDeleteButton"
import ReconcileButton from "./ReconcileButton"
import PrivateAmount from "@/components/PrivateAmount"
import { fmtCurrency } from "@/lib/fmt"

const TYPE_LABEL: Record<string, string> = {
  CHECKING: "Cuenta corriente", SAVINGS: "Cuenta de ahorro",
  CREDIT_CARD: "Tarjeta de crédito", CASH: "Efectivo", INVESTMENT: "Inversiones",
}

const BANK_DOT: Record<string, string> = { Santander: "#e63946", BCI: "#2196f3" }

export default async function AccountsPage() {
  const session = await auth()
  const accounts = await getAccountsData(session!.user!.id as string)

  const groups: Record<string, typeof accounts> = {}
  for (const acc of accounts) {
    const key = acc.bank ?? "Otros"
    if (!groups[key]) groups[key] = []
    groups[key].push(acc)
  }

  // Group totals by currency
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

  const card = "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"

  return (
    <div className="max-w-3xl mx-auto px-5 lg:px-10 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Cuentas</h1>
        <NewAccountButton />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">Efectivo disponible</p>
          {Object.entries(cashByCurrency).length === 0
            ? <PrivateAmount value={fmtCurrency(0)} className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums" />
            : Object.entries(cashByCurrency).map(([cur, amt]) => (
              <PrivateAmount key={cur} value={fmtCurrency(amt, cur)} className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums block" />
            ))
          }
        </div>
        <div className={`${card} p-4`}>
          <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">Deuda en tarjetas</p>
          {Object.entries(debtByCurrency).length === 0
            ? <PrivateAmount value={fmtCurrency(0)} className="text-[20px] font-semibold text-[#ff3b30] tabular-nums" />
            : Object.entries(debtByCurrency).map(([cur, amt]) => (
              <PrivateAmount key={cur} value={amt > 0 ? `−${fmtCurrency(amt, cur)}` : fmtCurrency(0, cur)} className="text-[20px] font-semibold text-[#ff3b30] tabular-nums block" />
            ))
          }
        </div>
      </div>

      {Object.entries(groups).map(([bank, bankAccounts]) => {
        const regular = bankAccounts.filter((a) => a.type !== "CREDIT_CARD")
        const cards = bankAccounts.filter((a) => a.type === "CREDIT_CARD")
        // show bank subtotal only if all regular accounts share same currency
        const bankCurrencies = [...new Set(regular.map(a => a.currency ?? "CLP"))]
        const bankCash = regular.reduce((s, a) => s + Number(a.balance), 0)
        const dot = BANK_DOT[bank] ?? "#86868b"

        return (
          <div key={bank}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />
              <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">{bank}</span>
              <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
              {regular.length > 0 && bankCurrencies.length === 1 && (
                <PrivateAmount value={fmtCurrency(bankCash, bankCurrencies[0])} className="text-[12px] text-[#86868b] tabular-nums" />
              )}
            </div>
            <div className="space-y-2">
              {regular.map((acc) => {
                const cur = acc.currency ?? "CLP"
                return (
                <div key={acc.id} className={`${card} px-4 py-3.5 flex items-center gap-3`}>
                  <Link href={`/dashboard/accounts/${acc.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-70 transition-opacity">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${acc.color}18` }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{acc.name}</p>
                      <p className="text-[11px] text-[#86868b]">{TYPE_LABEL[acc.type]} · {cur !== "CLP" && <span className="font-medium text-[#007aff]">{cur} · </span>}{acc._count.transactions} mov.</p>
                    </div>
                  </Link>
                  <PrivateAmount value={fmtCurrency(Number(acc.balance), cur)} className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums flex-shrink-0" />
                  <ReconcileButton accountId={acc.id} currentBalance={Number(acc.balance)} />
                  <AccountDeleteButton accountId={acc.id} accountName={acc.name} txCount={acc._count.transactions} />
                </div>
                )
              })}

              {cards.map((c) => {
                const cur = c.currency ?? "CLP"
                const used = Math.abs(Number(c.balance))
                const limit = Number(c.creditLimit) || 0
                const available = limit > 0 ? limit - used : null
                const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null
                const barColor = pct == null ? "#86868b" : pct >= 80 ? "#ff3b30" : pct >= 50 ? "#ff9500" : "#34c759"

                return (
                  <div key={c.id} className={`${card} px-4 py-4`}>
                    <div className="flex items-center justify-between mb-3.5">
                      <Link href={`/dashboard/accounts/${c.id}`} className="flex items-center gap-3 hover:opacity-70 transition-opacity">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}18` }}>
                          <svg className="w-4 h-4" style={{ color: c.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">{c.name}</p>
                          <p className="text-[11px] text-[#86868b]">Tarjeta de crédito · {cur !== "CLP" && <span className="font-medium text-[#007aff]">{cur} · </span>}{c._count.transactions} mov.</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        {pct != null && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums" style={{ color: barColor, backgroundColor: `${barColor}18` }}>
                          {pct}% usado
                        </span>
                        )}
                        <ReconcileButton accountId={c.id} currentBalance={-Math.abs(Number(c.balance))} />
                        <AccountDeleteButton accountId={c.id} accountName={c.name} txCount={c._count.transactions} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                      <div className="bg-[#f5f5f7] dark:bg-black/30 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-[#86868b] font-medium mb-0.5">Utilizado</p>
                        <PrivateAmount value={fmtCurrency(used, cur)} className="text-[13px] font-semibold text-[#ff3b30] tabular-nums" />
                      </div>
                      {available != null && (
                        <div className="bg-[#f5f5f7] dark:bg-black/30 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] text-[#86868b] font-medium mb-0.5">Disponible</p>
                          <PrivateAmount value={fmtCurrency(available, cur)} className="text-[13px] font-semibold text-[#34c759] tabular-nums" />
                        </div>
                      )}
                    </div>
                    {pct != null && (
                      <div className="h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
