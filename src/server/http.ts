import "server-only"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { ApiError, unauthorized } from "./errors"
import { reportError } from "./services/monitoring"
import { userFromBearer } from "./services/apiTokens"

/**
 * Response envelope for /api/v1:
 *   success → { "data": ... }
 *   failure → { "error": { "code", "message", "fields"? } }
 */
export function ok(data: unknown, status = 200) {
  return Response.json({ data }, { status })
}

export function fail(err: ApiError) {
  return Response.json(
    { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } },
    { status: err.status },
  )
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (err instanceof z.ZodError) {
    const fields: Record<string, string[]> = {}
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_"
      ;(fields[key] ??= []).push(issue.message)
    }
    return new ApiError(422, "validation_error", err.issues[0]?.message ?? "Datos inválidos", fields)
  }
  const e = err as { message?: string; error?: unknown; stack?: string }
  console.error("[api] unhandled error", e?.message ?? "", e?.error ?? "", e?.stack ?? err)
  return new ApiError(500, "internal_error", "Error interno del servidor")
}

/** Maps any thrown value to the error envelope, recording unexpected (500) failures. */
async function handleError(err: unknown, req: Request, userId?: string) {
  const apiErr = toApiError(err)
  if (apiErr.status >= 500) {
    const e = err as { message?: string; stack?: string }
    await reportError({
      source: "api",
      message: `${req.method} ${new URL(req.url).pathname}: ${e?.message ?? String(err)}`,
      stack: e?.stack,
      path: new URL(req.url).pathname,
      userId,
      userAgent: req.headers.get("user-agent"),
    })
  }
  return fail(apiErr)
}

export async function requireUserId(): Promise<string> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) throw unauthorized()
  return id
}

/** Parses a JSON body; an empty body is treated as {}. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, "invalid_json", "El cuerpo de la petición no es JSON válido")
  }
}

export function readQuery(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams)
}

type Ctx<P> = { params: Promise<P> }
type Handler<P> = (args: { req: Request; userId: string; params: P }) => Promise<Response>

/**
 * Wraps an authenticated route handler: resolves the session user (401 otherwise),
 * maps thrown ApiError/ZodError to the error envelope, and for mutating methods
 * revalidates the dashboard so server-rendered pages show fresh data.
 */
export function withUser<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    let userId: string | undefined
    try {
      userId = await requireUserId()
      const params = (await ctx.params) ?? ({} as P)
      const res = await handler({ req, userId, params })
      if (req.method !== "GET" && res.ok) revalidatePath("/dashboard", "layout")
      return res
    } catch (err) {
      return handleError(err, req, userId)
    }
  }
}

/**
 * For automations (iPhone Shortcuts): authenticates with a personal token
 * (`Authorization: Bearer clf_…`) instead of the browser session.
 */
export function withToken(handler: (args: { req: Request; userId: string }) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    let userId: string | undefined
    try {
      userId = await userFromBearer(req)
      const res = await handler({ req, userId })
      if (res.ok) revalidatePath("/dashboard", "layout")
      return res
    } catch (err) {
      const res = await handleError(err, req, userId)
      if (new URL(req.url).searchParams.get("format") !== "text") return res
      // Shortcuts shows the body as is: send a readable sentence, not JSON.
      const body = (await res.json()) as { error: { message: string } }
      return new Response(`✗ Clarifi: ${body.error.message}`, { status: res.status, headers: { "content-type": "text/plain; charset=utf-8" } })
    }
  }
}

/** Same as withUser but without authentication (e.g. registration). */
export function withPublic(handler: (args: { req: Request }) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler({ req })
    } catch (err) {
      return handleError(err, req)
    }
  }
}
