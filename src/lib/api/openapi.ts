import { z } from "zod"
import * as S from "./schemas"

/**
 * OpenAPI 3.1 document for /api/v1, built from the same Zod schemas the
 * handlers validate with, so the docs can't drift from the implementation.
 */
type Op = {
  summary: string
  tag: string
  body?: z.ZodType
  query?: z.ZodObject
  status?: number
  public?: boolean
  /** Authenticated with a personal token (Bearer) instead of the session cookie. */
  token?: boolean
}

const schema = (s: z.ZodType) =>
  z.toJSONSchema(s, { io: "input", unrepresentable: "any", target: "draft-2020-12" }) as Record<string, unknown>

const routes: Record<string, Partial<Record<"get" | "post" | "put" | "patch" | "delete", Op>>> = {
  "/me": {
    get: { tag: "Perfil", summary: "Perfil y preferencias de la persona autenticada" },
    patch: { tag: "Perfil", summary: "Actualiza nombre, tema o preferencias", body: S.ProfileUpdate },
    delete: { tag: "Perfil", summary: "Elimina la cuenta y todos sus datos de forma permanente", body: S.AccountDeletion },
  },
  "/me/password": { post: { tag: "Perfil", summary: "Cambia la contraseña", body: S.PasswordChange } },
  "/me/export": { get: { tag: "Perfil", summary: "Descarga todos tus datos en un archivo JSON (incluye boletas en base64)" } },
  "/auth/register": {
    post: { tag: "Auth", summary: "Crea una cuenta con email y contraseña", body: S.Register, status: 201, public: true },
  },
  "/auth/password-reset": {
    post: { tag: "Auth", summary: "Envía un enlace para restablecer la contraseña (responde igual exista o no el email)", body: S.PasswordResetRequest, status: 202, public: true },
    get: { tag: "Auth", summary: "Indica si un enlace de restablecimiento sigue vigente", query: z.object({ token: z.string() }), public: true },
  },
  "/auth/password-reset/confirm": {
    post: { tag: "Auth", summary: "Fija la nueva contraseña con el token del email", body: S.PasswordResetConfirm, public: true },
  },
  "/push-subscriptions": {
    get: { tag: "Notificaciones", summary: "Dispositivos suscritos, si el servidor puede enviar push y su clave VAPID pública" },
    post: { tag: "Notificaciones", summary: "Suscribe este navegador a notificaciones push", body: S.PushSubscriptionInput, status: 201 },
    delete: { tag: "Notificaciones", summary: "Quita un dispositivo", body: S.PushUnsubscribe },
  },
  "/push-subscriptions/test": {
    post: { tag: "Notificaciones", summary: "Envía una notificación de prueba a tus dispositivos" },
  },
  "/errors": {
    post: { tag: "Operación", summary: "Reporta un error ocurrido en el navegador", body: S.ClientErrorReport, status: 202, public: true },
  },
  "/accounts": {
    get: { tag: "Cuentas", summary: "Lista cuentas y tarjetas" },
    post: { tag: "Cuentas", summary: "Crea una cuenta o tarjeta", body: S.AccountCreate, status: 201 },
  },
  "/accounts/{id}": {
    get: { tag: "Cuentas", summary: "Obtiene una cuenta" },
    patch: { tag: "Cuentas", summary: "Edita nombre, banco, color o cupo", body: S.AccountUpdate },
    delete: { tag: "Cuentas", summary: "Elimina una cuenta y sus movimientos" },
  },
  "/accounts/{id}/reconcile": {
    post: { tag: "Cuentas", summary: "Ajusta el saldo al real registrando la diferencia", body: S.AccountReconcile },
  },
  "/accounts/{id}/transactions": {
    get: { tag: "Cuentas", summary: "Cartola: movimientos de la cuenta", query: S.TransactionListQuery },
  },
  "/transactions": {
    get: { tag: "Movimientos", summary: "Lista movimientos con filtros y paginación", query: S.TransactionListQuery },
    post: { tag: "Movimientos", summary: "Registra un ingreso o gasto", body: S.TransactionCreate, status: 201 },
  },
  "/transactions/bulk-delete": {
    post: { tag: "Movimientos", summary: "Elimina varios movimientos a la vez (p. ej. un mes entero) y revierte los saldos", body: S.TransactionBulkDelete },
  },
  "/transactions/{id}": {
    get: { tag: "Movimientos", summary: "Obtiene un movimiento" },
    patch: { tag: "Movimientos", summary: "Edita un movimiento (recalcula saldos)", body: S.TransactionUpdate },
    delete: { tag: "Movimientos", summary: "Elimina un movimiento (revierte saldos)" },
  },
  "/transactions/import": {
    post: { tag: "Movimientos", summary: "Importa movimientos en lote", body: S.TransactionImport, status: 201 },
  },
  "/transactions/suggestions": {
    get: { tag: "Movimientos", summary: "Sugerencias para el formulario: descripciones frecuentes con su categoría, cuenta y monto habituales" },
  },
  "/me/setup": {
    post: { tag: "Perfil", summary: "Aplica lo armado en el registro paso a paso (cuenta, suscripciones, meta, presupuestos). Solo una vez: 409 si ya hay cuentas", body: S.AccountSetup },
  },
  "/me/tokens": {
    get: { tag: "Perfil", summary: "Tokens personales para automatizaciones (sin el valor del token)" },
    post: { tag: "Perfil", summary: "Crea un token personal; el valor solo viene en esta respuesta", body: S.ApiTokenCreate, status: 201 },
  },
  "/me/tokens/{id}": {
    delete: { tag: "Perfil", summary: "Revoca un token: las automatizaciones que lo usan dejan de funcionar" },
  },
  "/shortcuts/{token}": {
    post: { tag: "Automatizaciones", summary: "URL personal para Atajos: el token va en la ruta (sin encabezados) y responde texto listo para la notificación", body: S.ShortcutTransaction, status: 201, public: true },
  },
  "/shortcuts/transaction": {
    post: { tag: "Automatizaciones", summary: "Registra un pago de Apple Pay enviado por Atajos del iPhone (elige cuenta por la tarjeta y categoría por el comercio)", body: S.ShortcutTransaction, status: 201, token: true },
  },
  "/me/onboarding": {
    get: { tag: "Perfil", summary: "Primeros pasos y progreso (crear la cuenta ya cuenta como paso)" },
  },
  "/subscriptions/insight": {
    get: { tag: "Suscripciones", summary: "Total mensual de suscripciones y qué porcentaje de tus ingresos representa" },
  },
  "/transactions/{id}/receipt": {
    get: { tag: "Movimientos", summary: "Imagen de la boleta adjunta (JPG, PNG o WebP)" },
    put: { tag: "Movimientos", summary: "Adjunta o reemplaza la foto de la boleta (multipart: file, máx. 2 MB)", body: z.object({ file: z.string().describe("Imagen JPG, PNG o WebP") }) },
    delete: { tag: "Movimientos", summary: "Quita la boleta del movimiento" },
  },
  "/transactions/import/preview": {
    post: {
      tag: "Movimientos",
      summary: "Lee una cartola bancaria (Excel o CSV, multipart: file, accountId?) y devuelve los movimientos detectados sin guardarlos; marca duplicados y sugiere categorías",
      body: z.object({ file: z.string().describe("Archivo .xls, .xlsx o .csv (máx. 4 MB)"), accountId: z.string().optional() }),
    },
  },
  "/transfers": {
    post: { tag: "Movimientos", summary: "Transfiere entre dos cuentas propias", body: S.TransferCreate, status: 201 },
  },
  "/categories": {
    get: { tag: "Categorías", summary: "Lista categorías", query: z.object({ type: S.CategoryType.optional() }) },
    post: { tag: "Categorías", summary: "Crea una categoría", body: S.CategoryCreate, status: 201 },
  },
  "/categories/{id}": {
    patch: { tag: "Categorías", summary: "Edita una categoría", body: S.CategoryUpdate },
    delete: { tag: "Categorías", summary: "Elimina una categoría (los movimientos quedan sin categoría)" },
  },
  "/budgets": {
    get: { tag: "Presupuestos", summary: "Presupuesto y gasto por categoría de un mes", query: S.BudgetPeriodQuery },
    put: { tag: "Presupuestos", summary: "Fija el presupuesto de una categoría (0 lo elimina)", body: S.BudgetUpsert },
  },
  "/budgets/copy-previous": {
    post: { tag: "Presupuestos", summary: "Copia los presupuestos del último mes que tenga", body: S.BudgetCopy },
  },
  "/budgets/apply-suggested": {
    post: { tag: "Presupuestos", summary: "Fija en cada categoría sin presupuesto su gasto promedio de los últimos 3 meses", body: S.BudgetCopy },
  },
  "/savings-goals": {
    get: { tag: "Metas", summary: "Lista metas de ahorro" },
    post: { tag: "Metas", summary: "Crea una meta", body: S.SavingsGoalCreate, status: 201 },
  },
  "/savings-goals/{id}": {
    patch: { tag: "Metas", summary: "Edita una meta", body: S.SavingsGoalUpdate },
    delete: { tag: "Metas", summary: "Elimina una meta" },
  },
  "/savings-goals/{id}/contributions": {
    post: { tag: "Metas", summary: "Abona (o retira, con monto negativo) a una meta", body: S.SavingsContribution, status: 201 },
  },
  "/subscriptions": {
    get: { tag: "Suscripciones", summary: "Lista suscripciones", query: z.object({ active: z.enum(["true", "false"]).optional() }) },
    post: { tag: "Suscripciones", summary: "Crea una suscripción", body: S.SubscriptionCreate, status: 201 },
  },
  "/subscriptions/{id}": {
    patch: { tag: "Suscripciones", summary: "Edita o pausa una suscripción", body: S.SubscriptionUpdate },
    delete: { tag: "Suscripciones", summary: "Elimina una suscripción" },
  },
  "/recurring": {
    get: { tag: "Recurrentes", summary: "Lista movimientos recurrentes" },
    post: { tag: "Recurrentes", summary: "Crea un movimiento recurrente mensual", body: S.RecurringCreate, status: 201 },
  },
  "/recurring/{id}": {
    patch: { tag: "Recurrentes", summary: "Activa o pausa", body: S.RecurringUpdate },
    delete: { tag: "Recurrentes", summary: "Elimina" },
  },
  "/recurring/run": { post: { tag: "Recurrentes", summary: "Genera los movimientos recurrentes pendientes" } },
  "/reports/summary": { get: { tag: "Reportes", summary: "Resumen: saldos, mes en curso, últimos movimientos" } },
  "/reports/analytics": {
    get: { tag: "Reportes", summary: "Ingresos vs gastos, categorías y proyección", query: S.AnalyticsQuery },
  },
  "/reports/notifications": { get: { tag: "Reportes", summary: "Alertas de cobros próximos e inactividad" } },
}

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string", examples: ["validation_error"] },
        message: { type: "string" },
        fields: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
      },
      required: ["code", "message"],
    },
  },
}

function queryParams(q: z.ZodObject) {
  const json = schema(q) as { properties?: Record<string, object>; required?: string[] }
  return Object.entries(json.properties ?? {}).map(([name, s]) => ({
    name, in: "query", required: json.required?.includes(name) ?? false, schema: s,
  }))
}

export function buildOpenApi(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const [path, methods] of Object.entries(routes)) {
    paths[path] = {}
    for (const [method, op] of Object.entries(methods)) {
      const status = String(op!.status ?? 200)
      paths[path][method] = {
        tags: [op!.tag],
        summary: op!.summary,
        ...(op!.public ? { security: [] } : op!.token ? { security: [{ token: [] }] } : {}),
        parameters: [
          ...[...path.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: "path", required: true, schema: { type: "string" } })),
          ...(op!.query ? queryParams(op!.query) : []),
        ],
        ...(op!.body
          ? { requestBody: { required: true, content: { "application/json": { schema: schema(op!.body) } } } }
          : {}),
        responses: {
          [status]: {
            description: "OK",
            content: { "application/json": { schema: { type: "object", properties: { data: {} } } } },
          },
          "401": { description: "Sin sesión", content: { "application/json": { schema: errorSchema } } },
          "404": { description: "No existe o no es tuyo", content: { "application/json": { schema: errorSchema } } },
          "422": { description: "Datos inválidos", content: { "application/json": { schema: errorSchema } } },
        },
      }
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Clarifi API",
      version: "1.0.0",
      description:
        "API REST de Clarifi. Toda la app usa esta API. Autenticación: cookie de sesión de NextAuth " +
        "(inicia sesión en /login o vía /api/auth). Respuestas: { data } o { error: { code, message, fields } }. " +
        "Montos en número (CLP por defecto); fechas como YYYY-MM-DD o ISO 8601.",
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "authjs.session-token" },
        token: { type: "http", scheme: "bearer", description: "Token personal (clf_…) creado en Perfil → Atajos del iPhone" },
      },
    },
    security: [{ session: [] }],
    paths,
  }
}

export const API_ROUTES = Object.keys(routes)
