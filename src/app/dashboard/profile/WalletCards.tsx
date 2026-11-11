"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { api, type WalletCard } from "@/lib/api/client"

type Acc = { id: string; name: string; type: string }

/**
 * Each card the phone has reported, and the account its payments go to. Choosing one
 * also moves the payments already recorded with that card (balances included).
 */
export default function WalletCards({ reloadKey = 0 }: { reloadKey?: number }) {
  const router = useRouter()
  const [cards, setCards] = useState<WalletCard[] | null>(null)
  const [accounts, setAccounts] = useState<Acc[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    api.me.cards.list().then(r => setCards(r.ok ? r.data : []))
    api.accounts.list().then(r => {
      if (r.ok) setAccounts((r.data as Acc[]).filter(a => a.type !== "INVESTMENT"))
    })
  }, [reloadKey])

  if (!cards?.length || !accounts.length) return null
  const name = (id: string | null | undefined) => accounts.find(a => a.id === id)?.name

  async function assign(card: string, accountId: string) {
    setBusy(card); setMsg(null)
    const r = await api.me.cards.assign({ card, accountId, moveExisting: true })
    setBusy(null)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: `Listo: “${card}” va a ${r.data.account.name}${r.data.moved ? ` · ${r.data.moved} ${r.data.moved === 1 ? "pago movido" : "pagos movidos"}` : ""}.` })
    const fresh = await api.me.cards.list()
    if (fresh.ok) setCards(fresh.data)
    router.refresh()
  }

  return (
    <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
      <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tus tarjetas</p>
      <p className="text-[12px] text-[#86868b] mt-0.5 mb-3">Elige a qué cuenta va cada tarjeta. Los pagos que ya entraron con ella también se mueven.</p>
      <ul className="space-y-2.5">
        {cards.map(c => {
          const where = c.accountId ?? c.current[0]?.[0] ?? ""
          const mixed = !c.accountId && c.current.length > 1
          return (
            <motion.li key={c.card} layout className="flex items-center gap-3">
              <span className="flex-shrink-0 w-9 h-6 rounded-md bg-gradient-to-br from-[#3a3a3c] to-[#1d1d1f] dark:from-[#636366] dark:to-[#3a3a3c]" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{c.card}</p>
                <p className="text-[11px] text-[#86868b]">
                  {c.payments} {c.payments === 1 ? "pago" : "pagos"}
                  {c.accountId ? "" : mixed ? " · en varias cuentas" : " · elegida por Clarifi"}
                </p>
              </div>
              <select
                value={c.accountId ? where : ""}
                disabled={busy === c.card}
                onChange={e => e.target.value && assign(c.card, e.target.value)}
                aria-label={`Cuenta para ${c.card}`}
                className={`max-w-[46%] px-2.5 py-2 rounded-xl text-[12px] font-medium border border-transparent focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-40 ${c.accountId ? "bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white" : "bg-[#ff9500]/10 text-[#c93400] dark:text-[#ff9f0a]"}`}>
                {!c.accountId && <option value="">{name(where) ? `¿${name(where)}?` : "Elegir cuenta"}</option>}
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </motion.li>
          )
        })}
      </ul>
      {msg && <p className={`mt-3 text-[12px] ${msg.ok ? "text-[#34c759]" : "text-[#ff3b30]"}`}>{msg.text}</p>}
    </div>
  )
}
