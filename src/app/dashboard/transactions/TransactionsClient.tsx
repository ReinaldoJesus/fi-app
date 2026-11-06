"use client"
import { useRef, useState, useTransition, useMemo, useActionState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api/client"
import NewTransactionButton from "../components/NewTransactionButton"
import NewTransferButton from "../components/NewTransferButton"
import ConfirmDialog from "@/components/ConfirmDialog"

type Tx = {
  id: string; amount: number; type: string; description: string | null; notes: string | null; date: string
  category: { id: string; name: string; color: string; icon: string | null } | null
  account: { id: string; name: string }
}
type Account = { id: string; name: string; type: string; balance: number }
type Category = { id: string; name: string; type: string; icon: string | null }
type Recurring = {
  id: string; type: string; amount: number; description: string | null; dayOfMonth: number; active: boolean
  account: { id: string; name: string }
  category: { id: string; name: string; icon: string | null } | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

function parseCSV(text: string): string[][] {
  return text.trim().split("\n").map(line => {
    const cells: string[] = []
    let cur = "", inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if ((ch === ";" || ch === ",") && !inQ) { cells.push(cur.trim()); cur = "" }
      else { cur += ch }
    }
    cells.push(cur.trim())
    return cells
  })
}

function exportCSV(txs: Tx[]) {
  const headers = ["Fecha", "Descripción", "Tipo", "Monto (CLP)", "Cuenta", "Categoría"]
  const rows = txs.map(t => [
    new Date(t.date).toLocaleDateString("es-CL"),
    t.description ?? "",
    t.type === "INCOME" ? "Ingreso" : "Gasto",
    t.amount.toString(),
    t.account.name,
    t.category?.name ?? "",
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"))
    .join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `transacciones-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function toDateInput(iso: string) { return iso.slice(0, 10) }

function groupByDate(txs: Tx[]) {
  const groups: [string, Tx[]][] = []
  const map: Record<string, Tx[]> = {}
  for (const tx of txs) {
    const key = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" })
      .format(new Date(tx.date))
    const label = key.charAt(0).toUpperCase() + key.slice(1)
    if (!map[label]) { map[label] = []; groups.push([label, map[label]]) }
    map[label].push(tx)
  }
  return groups
}

function getMonthOptions() {
  const now = new Date()
  const options: { label: string; value: string }[] = [{ label: "Todos los meses", value: "" }]
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(d)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    options.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value })
  }
  return options
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[13px]"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"

export default function TransactionsClient({
  initialTransactions, accounts, categories, defaultAccountId, budgetStatus, initialRecurring,
}: {
  initialTransactions: Tx[]
  accounts: Account[]
  categories: Category[]
  defaultAccountId?: string | null
  budgetStatus?: Record<string, { budget: number; spent: number }>
  initialRecurring?: Recurring[]
}) {
  const router = useRouter()
  const editRef = useRef<HTMLDialogElement>(null)
  const importRef = useRef<HTMLDialogElement>(null)
  const recurringRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<Tx | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Tx | null>(null)
  const [importRows, setImportRows] = useState<{ type: string; amount: number; description: string; date: string; accountId: string; categoryId?: string }[]>([])
  const [importAccountId, setImportAccountId] = useState("")
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState<number | null>(null)
  const [importError, setImportError] = useState("")
  const [importDupeCount, setImportDupeCount] = useState(0)

  // Recurring state
  const [recurring, setRecurring] = useState<Recurring[]>(initialRecurring ?? [])
  const [recurringTab, setRecurringTab] = useState<"list" | "new">("list")
  const [rType, setRType] = useState<"INCOME" | "EXPENSE">("EXPENSE")
  const [rAccountId, setRAccountId] = useState(accounts[0]?.id ?? "")
  const [rCategoryId, setRCategoryId] = useState("")
  const [rAmount, setRAmount] = useState("")
  const [rDescription, setRDescription] = useState("")
  const [rDay, setRDay] = useState("1")
  const [rSaving, setRSaving] = useState(false)
  const [rError, setRError] = useState("")
  const [confirmDeleteRecurring, setConfirmDeleteRecurring] = useState<Recurring | null>(null)

  // Filters
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL")
  const [filterAccount, setFilterAccount] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [filterMonth, setFilterMonth] = useState("")
  const [search, setSearch] = useState("")

  const [editState, editAction, editPending] = useActionState(async (_: unknown, fd: FormData) => {
    if (!editing) return undefined
    const r = await api.transactions.update(editing.id, fd)
    if (!r.error) {
      editRef.current?.close()
      router.refresh()
      return undefined
    }
    return r
  }, undefined)

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (rows.length < 2) return
      const start = rows[0].some(c => /fecha|date|tipo|type/i.test(c)) ? 1 : 0
      const defaultAccount = importAccountId || accounts[0]?.id || ""
      const parsed = rows.slice(start).map(r => {
        const [dateStr, description, typeStr, amountStr] = r
        const rawAmount = parseFloat((amountStr ?? "").replace(/[^0-9.,\-]/g, "").replace(",", ".")) || 0
        const type = /ingreso|income/i.test(typeStr ?? "") ? "INCOME" : "EXPENSE"
        let date = ""
        if (/\d{2}\/\d{2}\/\d{4}/.test(dateStr ?? "")) {
          const [d, m, y] = (dateStr ?? "").split("/")
          date = `${y}-${m}-${d}`
        } else {
          date = (dateStr ?? "").slice(0, 10)
        }
        const matchedCat = categories.find(c => c.name.toLowerCase() === (r[5] ?? "").toLowerCase())
        return { type, amount: Math.abs(rawAmount), description: description ?? "", date, accountId: defaultAccount, categoryId: matchedCat?.id }
      }).filter(r => r.amount > 0 && r.date)
      const seen = new Set<string>()
      const deduped = parsed.filter(r => {
        const key = `${r.date}|${r.amount}|${r.description}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setImportDupeCount(parsed.length - deduped.length)
      setImportRows(deduped)
      importRef.current?.showModal()
    }
    reader.readAsText(file, "utf-8")
    e.target.value = ""
  }

  async function confirmImport() {
    if (!importRows.length) return
    setImporting(true)
    setImportError("")
    const result = await api.transactions.import(
      importRows.map(r => ({ ...r, type: r.type as "INCOME" | "EXPENSE" })),
    )
    setImporting(false)
    if (!result.ok) {
      setImportError(result.error)
    } else {
      setImportDone(result.data.imported)
      setImportRows([])
      router.refresh()
      setTimeout(() => { importRef.current?.close(); setImportDone(null) }, 1500)
    }
  }

  function openEdit(tx: Tx) {
    setEditing(tx)
    editRef.current?.showModal()
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      await api.transactions.remove(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  async function saveRecurring() {
    const amount = parseFloat(rAmount.replace(/\./g, "").replace(",", "."))
    const day = parseInt(rDay)
    if (!rAccountId || !amount || !day) { setRError("Completa todos los campos requeridos"); return }
    setRSaving(true)
    setRError("")
    const r = await api.recurring.create({
      accountId: rAccountId,
      categoryId: rCategoryId || null,
      type: rType,
      amount,
      description: rDescription || null,
      dayOfMonth: day,
    })
    setRSaving(false)
    if (r.error) { setRError(r.error); return }
    router.refresh()
    setRAmount(""); setRDescription(""); setRDay("1"); setRCategoryId("")
    setRecurringTab("list")
    recurringRef.current?.close()
  }

  async function handleToggleRecurring(id: string, active: boolean) {
    const r = await api.recurring.setActive(id, active)
    if (r.error) return
    setRecurring(prev => prev.map(r => r.id === id ? { ...r, active } : r))
    router.refresh()
  }

  async function handleDeleteRecurring(id: string) {
    const r = await api.recurring.remove(id)
    if (r.error) return
    setRecurring(prev => prev.filter(r => r.id !== id))
    router.refresh()
  }

  const monthOptions = useMemo(() => getMonthOptions(), [])

  const filtered = useMemo(() => {
    return initialTransactions.filter(t => {
      if (filterType !== "ALL" && t.type !== filterType) return false
      if (filterAccount && t.account.id !== filterAccount) return false
      if (filterCategory && t.category?.id !== filterCategory) return false
      if (filterMonth) {
        const d = new Date(t.date)
        const txMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        if (txMonth !== filterMonth) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (!t.description?.toLowerCase().includes(q) && !t.category?.name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [initialTransactions, filterType, filterAccount, filterCategory, filterMonth, search])

  const totalIncome = filtered.filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0)
  const grouped = groupByDate(filtered)
  const editCategories = categories.filter(c => c.type === (editing?.type ?? "EXPENSE"))
  const hasFilters = search || filterType !== "ALL" || filterAccount || filterCategory || filterMonth

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Movimientos</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5">{initialTransactions.length} registros · 2 años</p>
        </div>
        {/* On phones the actions drop below the title and wrap instead of widening the page. */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => exportCSV(filtered)} title="Exportar CSV"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.09] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Importar CSV"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.09] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l4-4m-4 4V4" />
            </svg>
            Importar
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
          <button
            onClick={() => { setRecurringTab("list"); recurringRef.current?.showModal() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.09] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recurrentes {recurring.length > 0 && <span className="ml-0.5 text-[#86868b]">({recurring.filter(r => r.active).length})</span>}
          </button>
          <NewTransferButton accounts={accounts} />
          <NewTransactionButton accounts={accounts} categories={categories} defaultAccountId={defaultAccountId} budgetStatus={budgetStatus} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: "Total ingresos", value: `+${fmt(totalIncome)}`, color: "text-[#34c759]", count: filtered.filter(t => t.type === "INCOME").length },
          { label: "Total gastos", value: `−${fmt(totalExpense)}`, color: "text-[#ff3b30]", count: filtered.filter(t => t.type === "EXPENSE").length },
        ].map(({ label, value, color, count }) => (
          <div key={label} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.09] dark:border-white/[0.06]">
            <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">{label}</p>
            <p className={`text-[18px] font-semibold tabular-nums ${color}`}>{value}</p>
            <p className="text-[11px] text-[#86868b] mt-1">{count} movimientos</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-4 mb-5 space-y-3">
        <input
          type="text" placeholder="Buscar por descripción o categoría..."
          value={search} onChange={e => setSearch(e.target.value)}
          className={inputCls}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex gap-1 p-1 bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl col-span-2 sm:col-span-1">
            {(["ALL", "INCOME", "EXPENSE"] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  filterType === t ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b]"
                }`}>
                {t === "ALL" ? "Todos" : t === "INCOME" ? "↑" : "↓"}
              </button>
            ))}
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={inputCls}>
            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className={inputCls}>
            <option value="">Todas las cuentas</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={inputCls}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
          </select>
        </div>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterType("ALL"); setFilterAccount(""); setFilterCategory(""); setFilterMonth("") }}
            className="text-[12px] text-[#007aff] font-medium">
            Limpiar filtros · {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] px-5 py-12 text-center">
          <p className="text-[#86868b] text-sm">Sin transacciones</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateLabel, txs]) => (
            <div key={dateLabel}>
              <p className="text-[11px] font-semibold text-[#86868b] mb-2 px-1 uppercase tracking-wider">{dateLabel}</p>
              <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none divide-y divide-black/[0.06] dark:divide-white/[0.05]">
                {txs.map(t => (
                  <div key={t.id} className={`flex items-center gap-3.5 px-4 py-3.5 transition-opacity ${deletingId === t.id ? "opacity-40" : ""}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0"
                      style={{ backgroundColor: t.category?.color ? `${t.category.color}18` : "#f5f5f7" }}>
                      {t.category?.icon ?? (t.type === "INCOME" ? "↑" : t.type === "TRANSFER" ? "⇄" : "↓")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                        {t.description ?? t.category?.name ?? "Sin descripción"}
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">
                        {t.account.name}{t.category && <> · {t.category.name}</>}
                      </p>
                      {t.notes && <p className="text-[11px] text-[#86868b] mt-0.5 truncate italic">{t.notes}</p>}
                    </div>
                    <span className={`text-[13px] font-semibold tabular-nums flex-shrink-0 ${t.type === "INCOME" ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"}`}>
                      {t.type === "INCOME" ? "+" : t.type === "TRANSFER" ? "" : "−"}{fmt(t.amount)}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(t)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setConfirmDeleteTx(t)} disabled={deletingId === t.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all disabled:pointer-events-none">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-[#86868b] mt-5">
        Mostrando {filtered.length} de {initialTransactions.length} transacciones
      </p>

      {confirmDeleteTx && (
        <ConfirmDialog
          title="Eliminar transacción"
          message={`¿Eliminar "${confirmDeleteTx.description ?? confirmDeleteTx.category?.name ?? "esta transacción"}"? Esta acción no se puede deshacer.`}
          onConfirm={() => { const id = confirmDeleteTx.id; setConfirmDeleteTx(null); handleDelete(id) }}
          onCancel={() => setConfirmDeleteTx(null)}
        />
      )}

      {confirmDeleteRecurring && (
        <ConfirmDialog
          title="Eliminar transacción recurrente"
          message={`¿Eliminar "${confirmDeleteRecurring.description ?? "esta recurrente"}"? No se eliminarán las transacciones ya generadas.`}
          onConfirm={() => { const id = confirmDeleteRecurring.id; setConfirmDeleteRecurring(null); handleDeleteRecurring(id) }}
          onCancel={() => setConfirmDeleteRecurring(null)}
        />
      )}

      {/* ── Recurring dialog ── */}
      <dialog ref={recurringRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={e => { if (e.target === e.currentTarget) recurringRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Transacciones recurrentes</h3>
          <button type="button" onClick={() => recurringRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl mb-5">
          {(["list", "new"] as const).map(tab => (
            <button key={tab} onClick={() => setRecurringTab(tab)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                recurringTab === tab ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b]"
              }`}>
              {tab === "list" ? `Mis recurrentes (${recurring.length})` : "+ Nueva"}
            </button>
          ))}
        </div>

        {recurringTab === "list" ? (
          recurring.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[#86868b] text-[13px]">No tienes transacciones recurrentes.</p>
              <button onClick={() => setRecurringTab("new")} className="mt-3 text-[13px] text-[#007aff] font-medium">Crear una →</button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {recurring.map(r => (
                <div key={r.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  r.active ? "bg-white dark:bg-[#2c2c2e] border-black/[0.07] dark:border-white/[0.07]" : "bg-[#f5f5f7] dark:bg-white/[0.03] border-transparent opacity-60"
                }`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[14px] flex-shrink-0 bg-[#f5f5f7] dark:bg-white/[0.08]">
                    {r.category?.icon ?? (r.type === "INCOME" ? "💰" : "💸")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{r.description ?? r.category?.name ?? "Sin descripción"}</p>
                    <p className="text-[11px] text-[#86868b]">
                      Día {r.dayOfMonth} · {r.account.name}
                      {r.category && <> · {r.category.name}</>}
                    </p>
                  </div>
                  <span className={`text-[13px] font-semibold tabular-nums flex-shrink-0 ${r.type === "INCOME" ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"}`}>
                    {r.type === "INCOME" ? "+" : "−"}{fmt(r.amount)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleToggleRecurring(r.id, !r.active)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all text-[13px] ${r.active ? "text-[#34c759] hover:bg-[#34c759]/10" : "text-[#86868b] hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08]"}`}
                      title={r.active ? "Pausar" : "Activar"}>
                      {r.active ? "⏸" : "▶"}
                    </button>
                    <button onClick={() => setConfirmDeleteRecurring(r)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {rError && <p className="text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">{rError}</p>}

            <div className="grid grid-cols-2 gap-2 p-1 bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl">
              {(["EXPENSE", "INCOME"] as const).map(t => (
                <button key={t} onClick={() => setRType(t)}
                  className={`py-2 rounded-lg text-[13px] font-semibold transition-all ${
                    rType === t ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b]"
                  }`}>
                  {t === "EXPENSE" ? "Gasto" : "Ingreso"}
                </button>
              ))}
            </div>

            <div>
              <label className={labelCls}>Monto (CLP)</label>
              <input type="number" min="1" step="1" placeholder="0" value={rAmount} onChange={e => setRAmount(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input type="text" placeholder="Ej: Arriendo" value={rDescription} onChange={e => setRDescription(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Día del mes</label>
                <input type="number" min="1" max="28" placeholder="1" value={rDay} onChange={e => setRDay(e.target.value)} className={inputCls} />
                <p className="text-[10px] text-[#86868b] mt-1">Máx. día 28</p>
              </div>
              <div>
                <label className={labelCls}>Cuenta</label>
                <select value={rAccountId} onChange={e => setRAccountId(e.target.value)} className={inputCls}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            {categories.filter(c => c.type === rType).length > 0 && (
              <div>
                <label className={labelCls}>Categoría (opcional)</label>
                <select value={rCategoryId} onChange={e => setRCategoryId(e.target.value)} className={inputCls}>
                  <option value="">Sin categoría</option>
                  {categories.filter(c => c.type === rType).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2.5 pt-1">
              <button onClick={() => setRecurringTab("list")}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold">
                Cancelar
              </button>
              <button onClick={saveRecurring} disabled={rSaving}
                className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold hover:opacity-90 disabled:opacity-40">
                {rSaving ? "Guardando..." : "Crear"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* ── Import dialog ── */}
      <dialog ref={importRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={e => { if (e.target === e.currentTarget) importRef.current?.close() }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Importar transacciones</h3>
          <button type="button" onClick={() => importRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {importDone !== null ? (
          <div className="py-6 text-center">
            <p className="text-[32px] mb-2">✓</p>
            <p className="text-[15px] font-semibold text-[#34c759]">{importDone} transacciones importadas</p>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-[#86868b] mb-1">{importRows.length} transacciones detectadas.</p>
            {importError && <p className="text-[12px] text-[#ff3b30] mb-2">{importError}</p>}
            {importDupeCount > 0 && (
              <p className="text-[11px] text-[#ff9500] mb-3">{importDupeCount} fila{importDupeCount !== 1 ? "s" : ""} duplicada{importDupeCount !== 1 ? "s" : ""} eliminada{importDupeCount !== 1 ? "s" : ""} automáticamente.</p>
            )}
            <div className="mb-3">
              <label className={labelCls}>Cuenta por defecto</label>
              <select value={importAccountId} onChange={e => {
                const id = e.target.value
                setImportAccountId(id)
                setImportRows(rows => rows.map(r => ({ ...r, accountId: id })))
              }} className={inputCls}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="max-h-56 overflow-y-auto border border-black/[0.06] dark:border-white/[0.06] rounded-xl mb-4 text-[11px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#f5f5f7] dark:bg-[#2c2c2e]">
                  <tr>{["Fecha", "Descripción", "Tipo", "Monto"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-[#86868b] uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {importRows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-[#1d1d1f] dark:text-white">{r.date}</td>
                      <td className="px-3 py-2 text-[#1d1d1f] dark:text-white truncate max-w-[120px]">{r.description || "—"}</td>
                      <td className="px-3 py-2"><span className={`font-semibold ${r.type === "INCOME" ? "text-[#34c759]" : "text-[#ff3b30]"}`}>{r.type === "INCOME" ? "Ingreso" : "Gasto"}</span></td>
                      <td className="px-3 py-2 text-[#1d1d1f] dark:text-white tabular-nums">{fmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 50 && <p className="px-3 py-2 text-[#86868b]">+{importRows.length - 50} más...</p>}
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => importRef.current?.close()}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold">Cancelar</button>
              <button onClick={confirmImport} disabled={importing || !importRows.length}
                className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold hover:opacity-90 disabled:opacity-40">
                {importing ? "Importando..." : `Importar ${importRows.length}`}
              </button>
            </div>
          </>
        )}
      </dialog>

      {/* ── Edit dialog ── */}
      <dialog ref={editRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={e => { if (e.target === e.currentTarget) editRef.current?.close() }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Editar transacción</h3>
          <button type="button" onClick={() => editRef.current?.close()} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {editing && (
          <form key={editing.id} action={editAction} className="space-y-4">
            {editState?.error && (
              <p className="text-[13px] text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/20 px-3 py-2 rounded-xl">{editState.error}</p>
            )}
            <div>
              <label className={labelCls}>Tipo</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl">
                {(["EXPENSE", "INCOME"] as const).map(t => (
                  <label key={t} className="cursor-pointer">
                    <input type="radio" name="type" value={t} defaultChecked={editing.type === t} className="sr-only" />
                    <span className="block text-center py-2 rounded-lg text-[13px] font-semibold text-[#86868b] has-[input:checked]:bg-white has-[input:checked]:dark:bg-white/[0.12] has-[input:checked]:text-[#1d1d1f] has-[input:checked]:dark:text-white transition-all">
                      {t === "EXPENSE" ? "Gasto" : "Ingreso"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div><label className={labelCls}>Monto</label>
              <input name="amount" type="number" step="1" min="1" required defaultValue={editing.amount} className={inputCls} /></div>
            <div><label className={labelCls}>Descripción</label>
              <input name="description" type="text" placeholder="Opcional..." defaultValue={editing.description ?? ""} className={inputCls} /></div>
            <div><label className={labelCls}>Notas (opcional)</label>
              <textarea name="notes" placeholder="Detalles adicionales..." rows={2} defaultValue={editing.notes ?? ""} className={inputCls + " resize-none"} /></div>
            <div><label className={labelCls}>Cuenta</label>
              <select name="accountId" defaultValue={editing.account.id} className={inputCls}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <div><label className={labelCls}>Categoría</label>
              <select name="categoryId" defaultValue={editing.category?.id ?? ""} className={inputCls}>
                <option value="">Sin categoría</option>
                {editCategories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
              </select></div>
            <div><label className={labelCls}>Fecha</label>
              <input name="date" type="date" required defaultValue={toDateInput(editing.date)} className={inputCls} /></div>
            <div className="flex gap-2.5 pt-1">
              <button type="button" onClick={() => editRef.current?.close()}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold">Cancelar</button>
              <button type="submit" disabled={editPending}
                className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold text-[13px]">
                {editPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
