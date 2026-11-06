/**
 * API contract for /api/v1. Shared by the route handlers (validation), the typed
 * client (request shapes) and the OpenAPI document (generated from these schemas).
 *
 * Inputs accept both JSON values and the strings an HTML form produces, so a
 * FormData converted with `Object.fromEntries` validates the same as a JSON body.
 */
import { z } from "zod"

// ─── Primitives ──────────────────────────────────────────────────────────────

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v)

/** Optional text: "" becomes null so a form can clear a field. */
const optionalText = (max = 200) =>
  z.preprocess(v => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional())

const requiredText = (label: string, max = 100) =>
  z.string({ error: `${label} es obligatorio` }).trim().min(1, `${label} es obligatorio`).max(max)

const money = (label = "El monto") =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: `${label} es obligatorio` }).finite())

const positiveMoney = (label = "El monto") =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: `${label} es obligatorio` }).finite().positive(`${label} debe ser mayor a 0`))

const optionalMoney = () => z.preprocess(blankToUndefined, z.coerce.number().finite().nullable().optional())

const id = (label = "id") => z.string({ error: `${label} es obligatorio` }).min(1, `${label} es obligatorio`)
const optionalId = () => z.preprocess(v => (v === "" ? null : v), z.string().min(1).nullable().optional())

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usa #RRGGBB)")

/** Calendar date "YYYY-MM-DD" or an ISO date-time. */
const dateInput = z
  .string()
  .refine(s => /^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isNaN(Date.parse(s)), "Fecha inválida")

const bool = z.preprocess(v => (v === "true" || v === "on" ? true : v === "false" ? false : v), z.boolean())

export const AccountType = z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT"])
export const TransactionType = z.enum(["INCOME", "EXPENSE", "TRANSFER"])
export const CategoryType = z.enum(["INCOME", "EXPENSE"])
export const Theme = z.enum(["light", "dark", "system"])

// ─── Accounts ────────────────────────────────────────────────────────────────

export const AccountCreate = z.object({
  name: requiredText("El nombre"),
  type: AccountType,
  bank: optionalText(80),
  color: color.default("#10b981"),
  currency: z.string().length(3).toUpperCase().default("CLP"),
  /** Opening balance (ignored for credit cards). */
  balance: optionalMoney(),
  /** Credit cards: limit and amount already used. */
  creditLimit: optionalMoney(),
  usedAmount: optionalMoney(),
})

export const AccountUpdate = z.object({
  name: requiredText("El nombre").optional(),
  bank: optionalText(80),
  color: color.optional(),
  creditLimit: optionalMoney(),
})

export const AccountReconcile = z.object({
  realBalance: money("El saldo real"),
})

// ─── Transactions ────────────────────────────────────────────────────────────

export const TransactionCreate = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: positiveMoney(),
  accountId: id("La cuenta"),
  categoryId: optionalId(),
  description: optionalText(200),
  notes: optionalText(2000),
  date: z.preprocess(blankToUndefined, dateInput.optional()),
})

export const TransactionUpdate = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  amount: positiveMoney().optional(),
  accountId: id("La cuenta").optional(),
  categoryId: optionalId(),
  description: optionalText(200),
  notes: optionalText(2000),
  date: z.preprocess(blankToUndefined, dateInput.optional()),
})

export const TransactionImport = z.object({
  rows: z
    .array(
      z.object({
        type: z.enum(["INCOME", "EXPENSE"]),
        amount: positiveMoney(),
        description: optionalText(200),
        date: dateInput,
        accountId: id("La cuenta"),
        categoryId: optionalId(),
      }),
    )
    .min(1, "Sin filas para importar")
    .max(2000, "Máximo 2000 filas por importación"),
})

export const TransactionListQuery = z.object({
  from: dateInput.optional(),
  to: dateInput.optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  type: TransactionType.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
})

export const TransferCreate = z
  .object({
    fromAccountId: id("La cuenta de origen"),
    toAccountId: id("La cuenta de destino"),
    amount: positiveMoney(),
    description: optionalText(200),
    date: z.preprocess(blankToUndefined, dateInput.optional()),
  })
  .refine(d => d.fromAccountId !== d.toAccountId, {
    message: "Las cuentas deben ser diferentes",
    path: ["toAccountId"],
  })

// ─── Categories ──────────────────────────────────────────────────────────────

export const CategoryCreate = z.object({
  name: requiredText("El nombre", 60),
  type: CategoryType,
  icon: optionalText(16),
  color: color.default("#6366f1"),
})

export const CategoryUpdate = z.object({
  name: requiredText("El nombre", 60).optional(),
  icon: optionalText(16),
  color: color.optional(),
})

// ─── Budgets ─────────────────────────────────────────────────────────────────

const month = z.coerce.number().int().min(1).max(12)
const year = z.coerce.number().int().min(2000).max(2100)

export const BudgetPeriodQuery = z.object({ month: month.optional(), year: year.optional() })

export const BudgetUpsert = z.object({
  categoryId: id("La categoría"),
  month,
  year,
  /** 0 removes the budget. */
  amount: z.coerce.number().finite().min(0, "El monto no puede ser negativo"),
})

export const BudgetCopy = z.object({ month, year })

// ─── Savings goals ───────────────────────────────────────────────────────────

export const SavingsGoalCreate = z.object({
  name: requiredText("El nombre", 80),
  targetAmount: positiveMoney("La meta"),
  currentAmount: z.preprocess(blankToUndefined, z.coerce.number().finite().min(0).default(0)),
  icon: optionalText(16),
  color: color.default("#34c759"),
  deadline: z.preprocess(v => (v === "" ? null : v), dateInput.nullable().optional()),
})

export const SavingsGoalUpdate = z.object({
  name: requiredText("El nombre", 80).optional(),
  targetAmount: positiveMoney("La meta").optional(),
  icon: optionalText(16),
  color: color.optional(),
  deadline: z.preprocess(v => (v === "" ? null : v), dateInput.nullable().optional()),
})

export const SavingsContribution = z.object({
  /** Positive to add, negative to withdraw. */
  amount: z.coerce.number().finite().refine(n => n !== 0, "El monto no puede ser 0"),
})

// ─── Subscriptions ───────────────────────────────────────────────────────────

/** "" clears the billing day. */
const billingDay = z.preprocess(v => (v === "" ? null : v), z.coerce.number().int().min(1).max(31).nullable().optional())

export const SubscriptionCreate = z.object({
  name: requiredText("El nombre", 80),
  amount: positiveMoney(),
  currency: z.string().length(3).toUpperCase().default("CLP"),
  billingDay,
  category: optionalText(60),
  icon: optionalText(16),
})

export const SubscriptionUpdate = z.object({
  name: requiredText("El nombre", 80).optional(),
  amount: positiveMoney().optional(),
  billingDay,
  category: optionalText(60),
  icon: optionalText(16),
  active: bool.optional(),
})

// ─── Recurring transactions ─────────────────────────────────────────────────

export const RecurringCreate = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: positiveMoney(),
  accountId: id("La cuenta"),
  categoryId: optionalId(),
  description: optionalText(200),
  dayOfMonth: z.coerce.number().int().min(1, "Día debe ser entre 1 y 28").max(28, "Día debe ser entre 1 y 28"),
})

export const RecurringUpdate = z.object({ active: bool })

// ─── Profile / auth ──────────────────────────────────────────────────────────

export const ProfileUpdate = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  theme: Theme.optional(),
  budgetCarryOver: bool.optional(),
  notifSubscriptions: bool.optional(),
  notifInactivity: bool.optional(),
  hideAmountsOnStart: bool.optional(),
  defaultAccountId: optionalId(),
})

export const PasswordChange = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener mínimo 8 caracteres"),
})

export const Register = z
  .object({
    name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().trim().toLowerCase().pipe(z.email("Email inválido")),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[0-9]/, "Debe contener al menos un número"),
    confirmPassword: z.string().optional(),
  })
  .refine(d => d.confirmPassword === undefined || d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

export const AnalyticsQuery = z.object({ months: z.coerce.number().int().min(3).max(24).default(6) })

export type AccountCreateInput = z.infer<typeof AccountCreate>
export type TransactionCreateInput = z.infer<typeof TransactionCreate>
export type TransferCreateInput = z.infer<typeof TransferCreate>
