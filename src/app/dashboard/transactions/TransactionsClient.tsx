"use client"
import { useRef, useState, useTransition, useMemo, useActionState } from "react"
import { useRouter } from "next/navigation"
import { api, type StatementPreview } from "@/lib/api/client"
import { BrandLoader } from "@/components/BrandLoader"
import ReceiptField from "./ReceiptField"
import NewTransactionButton from "../components/NewTransactionButton"
import NewTransferButton from "../components/NewTransferButton"
import ConfirmDialog from "@/components/ConfirmDialog"

type Tx = {
  id: string; amount: number; type: string; description: string | null; notes: string | null; date: string
  createdAt?: string
  category: { id: string; name: string; color: string; icon: string | null } | null
  account: { id: string; name: string }
  hasReceipt?: boolean
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
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRows, setImportRows] = useState<(StatementPreview["rows"][number] & { include: boolean })[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importSkipped, setImportSkipped] = useState(0)
  const [importAccountId, setImportAccountId] = useState("")
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState<number | null>(null)
  const [importError, setImportError] = useState("")

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

  /** Sends the statement to the API, which detects columns, categories and duplicates. */
  async function previewImport(file: File, accountId: string) {
    setImportLoading(true)
    setImportError("")
    const r = await api.transactions.previewImport(file, accountId || undefined)
    setImportLoading(false)
    if (!r.ok) {
      setImportRows([])
      setImportError(r.error)
      return
    }
    setImportSkipped(r.data.skipped)
    // Rows already in the account start unchecked.
    setImportRows(r.data.rows.map(row => ({ ...row, include: !row.duplicate })))
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const accountId = importAccountId || defaultAccountId || accounts[0]?.id || ""
    setImportAccountId(accountId)
    setImportFile(file)
    setImportRows([])
    setImportDone(null)
    importRef.current?.showModal()
    previewImport(file, accountId)
  }

  const selectedImport = importRows.filter(r => r.include)
  const importDupeCount = importRows.filter(r => r.duplicate).length

  async function confirmImport() {
    if (!selectedImport.length || !importAccountId) return
    setImporting(true)
    setImportError("")
    const result = await api.transactions.import(
      selectedImport.map(r => ({
        type: r.type, amount: r.amount, description: r.description || undefined,
        date: r.date, accountId: importAccountId, categoryId: r.categoryId ?? undefined,
      })),
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

  /* ─── Several at once: select mode ──────────────────────────────────────── */
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  function stopSelecting() { setSelecting(false); setSelected(new Set()) }

  async function handleBulkDelete() {
    const ids = [...selected]
    setConfirmBulk(false); setBulkDeleting(true); setBulkMsg(null)
    const r = await api.transactions.removeMany(ids)
    setBulkDeleting(false)
    if (!r.ok) { setBulkMsg({ ok: false, text: r.error }); return }
    setBulkMsg({ ok: true, text: `${r.data.deleted} movimiento${r.data.deleted === 1 ? "" : "s"} eliminado${r.data.deleted === 1 ? "" : "s"}. Los saldos ya están ajustados.` })
    stopSelecting()
    router.refresh()
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
  const selectedTotal = filtered.filter(t => selected.has(t.id)).reduce((s, t) => s + t.amount, 0)
  const allSelected = filtered.length > 0 && filtered.every(t => selected.has(t.id))
  // Paid with the phone in the last 48 h: shown on top, since a bank import with later
  // posting dates can push them down the date-sorted list.
  const [now] = useState(() => Date.now())
  const autoSource = (t: Tx) => (t.notes?.startsWith("Apple Pay") ? "Apple Pay" : t.notes?.startsWith("Android") ? "Android" : null)
  const freshAuto = initialTransactions.filter(t => autoSource(t) && t.createdAt && now - new Date(t.createdAt).getTime() < 48 * 3600_000).slice(0, 3)
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
          <button onClick={() => fileInputRef.current?.click()} title="Importar cartola del banco (Excel o CSV)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.09] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l4-4m-4 4V4" />
            </svg>
            Importar
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden" onChange={handleFileImport} />
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
                {t === "ALL" ? "Todos" : t === "INCOME"
                  ? <><span className={filterType === t ? "text-[#34c759]" : ""}>↑</span> Ingresos</>
                  : <><span className={filterType === t ? "text-[#ff3b30]" : ""}>↓</span> Gastos</>}
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
        <div className="flex items-center justify-between gap-3">
          {hasFilters ? (
            <button onClick={() => { setSearch(""); setFilterType("ALL"); setFilterAccount(""); setFilterCategory(""); setFilterMonth("") }}
              className="text-[12px] text-[#007aff] font-medium">
              Limpiar filtros · {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </button>
          ) : <span />}
          <button onClick={() => (selecting ? stopSelecting() : (setSelecting(true), setBulkMsg(null)))}
            className="text-[12px] font-semibold text-[#007aff] hover:opacity-70">
            {selecting ? "Cancelar" : "Seleccionar varios"}
          </button>
        </div>
        {selecting && (
          <p className="text-[12px] text-[#86868b]">
            Toca los movimientos que quieres eliminar. Para borrar un mes entero, elige el mes arriba y toca <b>Seleccionar todos</b>.
          </p>
        )}
      </div>

      {bulkMsg && (
        <p className={`mb-4 px-4 py-3 rounded-xl text-[13px] ${bulkMsg.ok ? "bg-[#34c759]/10 text-[#248a3d] dark:text-[#30d158]" : "bg-[#ff3b30]/10 text-[#ff3b30]"}`}>{bulkMsg.text}</p>
      )}

      {freshAuto.length > 0 && !selecting && (
        <div className="mb-5 rounded-2xl border border-[#007aff]/25 bg-[#007aff]/[0.06] px-4 py-3">
          <p className="text-[11px] font-semibold text-[#007aff] uppercase tracking-wider mb-1.5">Registrados automáticamente</p>
          <ul className="space-y-1">
            {freshAuto.map(t => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-[#1d1d1f] dark:text-white">
                  {t.description ?? "Pago"} <span className="text-[#86868b]">· {autoSource(t)} · {new Date(t.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
                </span>
                <span className="flex-shrink-0 whitespace-nowrap font-semibold tabular-nums text-[#1d1d1f] dark:text-white">{t.type === "INCOME" ? "+" : "−"}{fmt(t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                  <div key={t.id}
                    onClick={selecting ? () => toggle(t.id) : undefined}
                    role={selecting ? "checkbox" : undefined} aria-checked={selecting ? selected.has(t.id) : undefined}
                    className={`flex items-center gap-3.5 px-4 py-3.5 transition-all ${deletingId === t.id ? "opacity-40" : ""} ${selecting ? "cursor-pointer select-none" : ""} ${selecting && selected.has(t.id) ? "bg-[#007aff]/[0.06]" : ""}`}>
                    {selecting && (
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected.has(t.id) ? "bg-[#007aff] border-[#007aff] text-white" : "border-[#c7c7cc] dark:border-[#48484a]"}`}>
                        {selected.has(t.id) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                    )}
                    {t.category?.icon ? (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0"
                        style={{ backgroundColor: t.category.color ? `${t.category.color}18` : undefined }}>
                        {t.category.icon}
                      </div>
                    ) : (
                      // No category icon: tint by movement type so it reads in light and dark mode.
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        t.type === "TRANSFER" ? "bg-[#007aff]/[0.12] text-[#007aff]"
                          : t.type === "INCOME" ? "bg-[#34c759]/[0.12] text-[#34c759]"
                          : "bg-[#ff3b30]/[0.1] text-[#ff3b30]"
                      }`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                          {t.type === "TRANSFER"
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h12m0 0l-3.5-3.5M19 7l-3.5 3.5M17 17H5m0 0l3.5 3.5M5 17l3.5-3.5" />
                            : t.type === "INCOME"
                              ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
                              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-6-6m6 6l6-6" />}
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                        {t.description ?? t.category?.name ?? "Sin descripción"}
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">
                        {t.account.name}{t.category && <> · {t.category.name}</>}
                      </p>
                      {t.notes && <p className="text-[11px] text-[#86868b] mt-0.5 truncate italic">{t.notes}</p>}
                      {t.hasReceipt && (
                        <a href={api.transactions.receiptUrl(t.id)} target="_blank" rel="noopener"
                          className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-[#007aff] hover:opacity-70">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          Boleta
                        </a>
                      )}
                    </div>
                    <span className={`text-[13px] font-semibold tabular-nums flex-shrink-0 whitespace-nowrap ${t.type === "INCOME" ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"}`}>
                      {t.type === "INCOME" ? "+" : t.type === "TRANSFER" ? "" : "−"}{fmt(t.amount)}
                    </span>
                    <div className={`items-center gap-1 flex-shrink-0 ${selecting ? "hidden" : "flex"}`}>
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

      {selecting && (
        <div className="fixed inset-x-0 z-40 px-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-64">
          <div className="max-w-4xl mx-auto flex items-center gap-2 rounded-2xl bg-[#1d1d1f] dark:bg-[#2c2c2e] text-white px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
            <button onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map(t => t.id)))}
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-[#64d2ff] hover:bg-white/10 whitespace-nowrap">
              {allSelected ? "Quitar todos" : `Seleccionar todos (${filtered.length})`}
            </button>
            <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate text-right">
              {selected.size > 0 ? `${selected.size} · ${fmt(selectedTotal)}` : "Nada elegido"}
            </span>
            <button onClick={() => setConfirmBulk(true)} disabled={!selected.size || bulkDeleting}
              className="px-3.5 py-2 rounded-xl bg-[#ff3b30] text-white text-[13px] font-semibold disabled:opacity-40 whitespace-nowrap">
              {bulkDeleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      )}

      {confirmBulk && (
        <ConfirmDialog
          title={`Eliminar ${selected.size} movimiento${selected.size === 1 ? "" : "s"}`}
          message={`Se eliminarán ${selected.size} movimiento${selected.size === 1 ? "" : "s"} y los saldos de tus cuentas se ajustarán. Esta acción no se puede deshacer.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulk(false)}
        />
      )}

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
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Importar cartola</h3>
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
            <p className="text-[12px] text-[#86868b] mb-3 truncate">
              {importFile?.name} · Excel (.xls, .xlsx) o CSV de tu banco.
            </p>
            <div className="mb-3">
              <label className={labelCls}>Cuenta de la cartola</label>
              <select value={importAccountId} onChange={e => {
                const id = e.target.value
                setImportAccountId(id)
                // Duplicates depend on the account: ask the API again.
                if (importFile) previewImport(importFile, id)
              }} className={inputCls}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {importError && <p className="text-[12px] text-[#ff3b30] mb-3">{importError}</p>}
            {importLoading ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <BrandLoader size={44} />
                <p className="text-[12px] text-[#86868b]">Leyendo la cartola…</p>
              </div>
            ) : importRows.length > 0 && (
              <>
                <p className="text-[12px] text-[#86868b] mb-2">
                  {importRows.length} movimiento{importRows.length !== 1 ? "s" : ""} detectado{importRows.length !== 1 ? "s" : ""}
                  {importSkipped > 0 && <> · {importSkipped} fila{importSkipped !== 1 ? "s" : ""} de saldo o totales ignorada{importSkipped !== 1 ? "s" : ""}</>}
                </p>
                {importDupeCount > 0 && (
                  <p className="text-[11px] text-[#ff9500] mb-2">
                    {importDupeCount} ya existe{importDupeCount !== 1 ? "n" : ""} en esta cuenta y quedó desmarcado{importDupeCount !== 1 ? "s" : ""}. Márcalo si de verdad es otro movimiento.
                  </p>
                )}
                <div className="max-h-64 overflow-y-auto border border-black/[0.06] dark:border-white/[0.06] rounded-xl mb-4 text-[11px] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {importRows.map((r, i) => (
                    <label key={r.line} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${r.include ? "" : "opacity-45"}`}>
                      <input type="checkbox" checked={r.include} className="accent-[#007aff] flex-shrink-0"
                        onChange={e => setImportRows(rows => rows.map((x, k) => k === i ? { ...x, include: e.target.checked } : x))} />
                      <span className="w-[68px] flex-shrink-0 text-[#86868b] tabular-nums">{r.date.slice(8)}/{r.date.slice(5, 7)}/{r.date.slice(2, 4)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[#1d1d1f] dark:text-white">{r.description || "—"}</span>
                        <span className="text-[10px] text-[#86868b]">
                          {categories.find(c => c.id === r.categoryId)?.name ?? "Sin categoría"}
                          {r.duplicate && <span className="ml-1.5 text-[#ff9500] font-semibold">· Ya existe</span>}
                        </span>
                      </span>
                      <span className={`font-semibold tabular-nums flex-shrink-0 ${r.type === "INCOME" ? "text-[#34c759]" : "text-[#1d1d1f] dark:text-white"}`}>
                        {r.type === "INCOME" ? "+" : "−"}{fmt(r.amount)}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2.5">
              <button onClick={() => importRef.current?.close()}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold">Cancelar</button>
              <button onClick={confirmImport} disabled={importing || importLoading || !selectedImport.length}
                className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-semibold hover:opacity-90 disabled:opacity-40">
                {importing ? "Importando..." : `Importar ${selectedImport.length}`}
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
            <ReceiptField
              transactionId={editing.id}
              hasReceipt={!!editing.hasReceipt}
              onChange={has => setEditing(e => (e ? { ...e, hasReceipt: has } : e))}
            />
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
