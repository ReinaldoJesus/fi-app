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

export const api = {
  me: {
    get: () => get("/me"),
    update: (body: In<typeof S.ProfileUpdate> | FormData) => patch("/me", body as Body),
    changePassword: (body: In<typeof S.PasswordChange>) => post<{ changed: true }>("/me/password", body),
  },
  auth: {
    register: (body: In<typeof S.Register> | FormData) => post<{ id: string; email: string }>("/auth/register", body as Body),
    requestPasswordReset: (body: In<typeof S.PasswordResetRequest> | FormData) => post<{ sent: true }>("/auth/password-reset", body as Body),
    checkResetToken: (token: string) => get<{ valid: boolean }>(`/auth/password-reset${qs({ token })}`),
    resetPassword: (body: In<typeof S.PasswordResetConfirm> | FormData) =>
      post<{ reset: true; email: string }>("/auth/password-reset/confirm", body as Body),
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
