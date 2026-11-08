/**
 * Browser client for /api/v1. Every mutation in the UI goes through here, so the
 * web app uses exactly the same API any other client (mobile, scripts) would.
 *
 * Calls never throw on HTTP errors: they resolve to `{ data }` or
 * `{ error, fields? }`, which maps directly onto form error messages.
 */
import type { z } from "zod"
import type * as S from "./schemas"

export type ApiResult<T = unknown> =
  | { ok: true; data: T; error?: undefined; fields?: undefined }
  | { ok: false; data?: undefined; error: string; fields?: Record<string, string[]> }

type In<T extends z.ZodType> = z.input<T>
type Body = Record<string, unknown> | FormData

const BASE = "/api/v1"

/** FormData → plain object (the API schemas accept form strings). */
export function formToJson(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v
  return out
}

async function request<T>(method: string, path: string, body?: Body): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body instanceof FormData ? formToJson(body) : body) : undefined,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: json?.error?.message ?? (res.status === 401 ? "Tu sesión expiró, vuelve a iniciar sesión" : "Algo salió mal"),
        fields: json?.error?.fields,
      }
    }
    return { ok: true, data: json?.data as T }
  } catch {
    return { ok: false, error: "No hay conexión con el servidor" }
  }
}

/** multipart/form-data upload (files); same envelope and error handling as request(). */
async function upload<T>(path: string, form: FormData, method: "POST" | "PUT" = "POST"): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, { method, credentials: "same-origin", body: form })
    const json = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: json?.error?.message ?? "Algo salió mal", fields: json?.error?.fields }
    return { ok: true, data: json?.data as T }
  } catch {
    return { ok: false, error: "No hay conexión con el servidor" }
  }
}

const get = <T>(path: string) => request<T>("GET", path)
const post = <T>(path: string, body?: Body) => request<T>("POST", path, body ?? {})
const put = <T>(path: string, body: Body) => request<T>("PUT", path, body)
const patch = <T>(path: string, body: Body) => request<T>("PATCH", path, body)
const del = <T>(path: string) => request<T>("DELETE", path)

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ""
}

type WithId = { id: string }

export type SetupResult = { account: string | null; subscriptions: number; goal: string | null; budgets: number }

export type TransactionSuggestions = {
  suggestions: { description: string; type: "INCOME" | "EXPENSE"; count: number; categoryId: string | null; accountId: string; amount: number }[]
  topCategory: { INCOME: string | null; EXPENSE: string | null }
  topAccount: string | null
}

export type StatementPreview = {
  fileName: string
  sheet: string
  rows: { line: number; date: string; description: string; type: "INCOME" | "EXPENSE"; amount: number; categoryId: string | null; duplicate: boolean }[]
  skipped: number
  duplicates: number
  truncated: boolean
}

export const api = {
  me: {
    get: () => get("/me"),
    update: (body: In<typeof S.ProfileUpdate> | FormData) => patch("/me", body as Body),
    changePassword: (body: In<typeof S.PasswordChange>) => post<{ changed: true }>("/me/password", body),
    /** Direct download link (the browser handles the file). */
    exportUrl: `${BASE}/me/export`,
    remove: (body: In<typeof S.AccountDeletion>) => request<{ deleted: true }>("DELETE", "/me", body),
    /** Applies the step-by-step signup (used after a Google/GitHub signup). */
    setup: (body: In<typeof S.AccountSetup>) => post<SetupResult>("/me/setup", body),
  },
  auth: {
    register: (body: In<typeof S.Register> | FormData) => post<{ id: string; email: string }>("/auth/register", body as Body),
    requestPasswordReset: (body: In<typeof S.PasswordResetRequest> | FormData) => post<{ sent: true }>("/auth/password-reset", body as Body),
    checkResetToken: (token: string) => get<{ valid: boolean }>(`/auth/password-reset${qs({ token })}`),
    resetPassword: (body: In<typeof S.PasswordResetConfirm> | FormData) =>
      post<{ reset: true; email: string }>("/auth/password-reset/confirm", body as Body),
  },
  push: {
    status: () => get<{ configured: boolean; publicKey: string | null; devices: { id: string; endpoint: string; userAgent: string | null; createdAt: string }[] }>("/push-subscriptions"),
    subscribe: (body: In<typeof S.PushSubscriptionInput>) => post<{ id: string; subscribed: true }>("/push-subscriptions", body),
    unsubscribe: (endpoint: string) => request<{ subscribed: false }>("DELETE", "/push-subscriptions", { endpoint }),
    test: () => post<{ devices: number; sent: number; removed: number }>("/push-subscriptions/test"),
  },
  errors: {
    report: (body: In<typeof S.ClientErrorReport>) => post<{ recorded: true }>("/errors", body),
  },
  accounts: {
    list: () => get("/accounts"),
    create: (body: In<typeof S.AccountCreate> | FormData) => post<WithId>("/accounts", body as Body),
    update: (id: string, body: In<typeof S.AccountUpdate> | FormData) => patch<WithId>(`/accounts/${id}`, body as Body),
    remove: (id: string) => del<WithId>(`/accounts/${id}`),
    reconcile: (id: string, realBalance: number) =>
      post<{ delta: number; balance: number }>(`/accounts/${id}/reconcile`, { realBalance }),
  },
  transactions: {
    list: (q: In<typeof S.TransactionListQuery> = {}) =>
      get(`/transactions${qs(q as Record<string, string | number | undefined>)}`),
    create: (body: In<typeof S.TransactionCreate> | FormData) => post<WithId>("/transactions", body as Body),
    update: (id: string, body: In<typeof S.TransactionUpdate> | FormData) => patch<WithId>(`/transactions/${id}`, body as Body),
    remove: (id: string) => del<WithId>(`/transactions/${id}`),
    import: (rows: In<typeof S.TransactionImport>["rows"]) => post<{ imported: number }>("/transactions/import", { rows }),
    suggestions: () => get<TransactionSuggestions>("/transactions/suggestions"),
    /** URL of the receipt image (owner-only; usable in <img src>). */
    receiptUrl: (id: string, version?: string | number) => `${BASE}/transactions/${id}/receipt${version ? `?v=${version}` : ""}`,
    uploadReceipt: (id: string, image: Blob) => {
      const form = new FormData()
      form.set("file", image, "boleta.jpg")
      return upload<{ transactionId: string; size: number }>(`/transactions/${id}/receipt`, form, "PUT")
    },
    removeReceipt: (id: string) => del<{ deleted: true }>(`/transactions/${id}/receipt`),
    /** Parses a bank statement on the server; nothing is saved until import(). */
    previewImport: (file: File, accountId?: string) => {
      const form = new FormData()
      form.set("file", file)
      if (accountId) form.set("accountId", accountId)
      return upload<StatementPreview>("/transactions/import/preview", form)
    },
  },
  transfers: {
    create: (body: In<typeof S.TransferCreate> | FormData) => post<WithId>("/transfers", body as Body),
  },
  categories: {
    list: (type?: "INCOME" | "EXPENSE") => get(`/categories${qs({ type })}`),
    create: (body: In<typeof S.CategoryCreate> | FormData) => post<WithId>("/categories", body as Body),
    update: (id: string, body: In<typeof S.CategoryUpdate> | FormData) => patch<WithId>(`/categories/${id}`, body as Body),
    remove: (id: string) => del<WithId>(`/categories/${id}`),
  },
  budgets: {
    month: (month?: number, year?: number) => get(`/budgets${qs({ month, year })}`),
    set: (body: In<typeof S.BudgetUpsert>) => put("/budgets", body),
    copyPrevious: (month: number, year: number) => post<{ copied: number }>("/budgets/copy-previous", { month, year }),
    applySuggested: (month: number, year: number) => post<{ applied: number }>("/budgets/apply-suggested", { month, year }),
  },
  savingsGoals: {
    list: () => get("/savings-goals"),
    create: (body: In<typeof S.SavingsGoalCreate> | FormData) => post<WithId>("/savings-goals", body as Body),
    update: (id: string, body: In<typeof S.SavingsGoalUpdate> | FormData) => patch<WithId>(`/savings-goals/${id}`, body as Body),
    remove: (id: string) => del<WithId>(`/savings-goals/${id}`),
    contribute: (id: string, amount: number) => post<WithId>(`/savings-goals/${id}/contributions`, { amount }),
  },
  subscriptions: {
    list: () => get("/subscriptions"),
    create: (body: In<typeof S.SubscriptionCreate> | FormData) => post<WithId>("/subscriptions", body as Body),
    update: (id: string, body: In<typeof S.SubscriptionUpdate> | FormData) => patch<WithId>(`/subscriptions/${id}`, body as Body),
    remove: (id: string) => del<WithId>(`/subscriptions/${id}`),
  },
  recurring: {
    list: () => get("/recurring"),
    create: (body: In<typeof S.RecurringCreate>) => post<WithId>("/recurring", body),
    setActive: (id: string, active: boolean) => patch<WithId>(`/recurring/${id}`, { active }),
    remove: (id: string) => del<WithId>(`/recurring/${id}`),
  },
}
