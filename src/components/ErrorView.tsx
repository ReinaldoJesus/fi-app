"use client"
import { useEffect } from "react"
import { api } from "@/lib/api/client"

const reported = new Set<string>()

/** Sends a browser-side error to /api/v1/errors once per page load. */
export function reportClientError(error: { message?: string; stack?: string; digest?: string }) {
  const message = error.message || "Error desconocido"
  const key = `${message}|${error.digest ?? ""}`
  if (reported.has(key) || reported.size >= 10) return
  reported.add(key)
  void api.errors.report({
    message,
    stack: error.stack?.slice(0, 8000),
    digest: error.digest,
    path: typeof location !== "undefined" ? location.pathname + location.search : undefined,
  })
}

/** Friendly error screen used by the error boundaries. */
export default function ErrorView({ error, retry, fullScreen = false }: {
  error: Error & { digest?: string }
  retry: () => void
  fullScreen?: boolean
}) {
  useEffect(() => { reportClientError(error) }, [error])

  return (
    <div className={`${fullScreen ? "min-h-screen" : "min-h-[60vh]"} flex flex-col items-center justify-center text-center px-6 anim-fade-in`}>
      <div className="w-14 h-14 rounded-2xl bg-[#ff9500]/[0.12] flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-[#ff9500]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white">Algo salió mal</h1>
      <p className="text-[14px] text-[#86868b] mt-1.5 max-w-sm">
        Ya registramos el problema para revisarlo. Tus datos están a salvo; intenta de nuevo.
      </p>
      {error.digest && <p className="text-[11px] text-[#86868b] mt-2 font-mono">Código: {error.digest}</p>}
      <div className="flex gap-2.5 mt-6">
        <button onClick={retry}
          className="px-5 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[14px] font-semibold hover:opacity-90">
          Reintentar
        </button>
        <a href="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-[#e5e5ea] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-white text-[14px] font-semibold hover:opacity-80">
          Ir al inicio
        </a>
      </div>
    </div>
  )
}

/** Mounted once in the root layout: catches errors outside React's boundaries. */
export function GlobalErrorListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Ignore cross-origin "Script error." noise and browser-extension errors.
      if (!e.error || e.filename?.startsWith("chrome-extension://")) return
      reportClientError(e.error)
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason
      reportClientError(r instanceof Error ? r : { message: `Promesa rechazada: ${String(r).slice(0, 500)}` })
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])
  return null
}
