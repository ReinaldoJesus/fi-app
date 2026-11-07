"use client"
import { useActionState } from "react"
import Link from "next/link"
import AuthShell from "@/components/AuthShell"
import { api } from "@/lib/api/client"

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px] transition-all"

type State = { sentTo?: string; error?: string } | undefined

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(async (_: State, form: FormData): Promise<State> => {
    const r = await api.auth.requestPasswordReset(form)
    if (!r.ok) return { error: r.fields?.email?.[0] ?? r.error }
    return { sentTo: String(form.get("email")) }
  }, undefined)

  return (
    <AuthShell
      title="Recupera tu acceso"
      subtitle="Te enviaremos un enlace para crear una nueva contraseña."
      footer={
        <p className="text-center text-[#86868b] text-[13px]">
          ¿La recordaste?{" "}
          <Link href="/login" className="text-[#007aff] font-medium hover:opacity-70 transition-opacity">Inicia sesión</Link>
        </p>
      }
    >
      {state?.sentTo ? (
        <div className="text-center py-2 anim-pop-in">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#34c759]/[0.12] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#34c759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Revisa tu correo</p>
          <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
            Si <span className="font-medium text-[#1d1d1f] dark:text-white">{state.sentTo}</span> tiene una cuenta en Clarifi,
            te llegará un enlace válido por 1 hora. Revisa también la carpeta de spam.
          </p>
        </div>
      ) : (
        <>
          {state?.error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff3b30]/[0.08] border border-[#ff3b30]/20 text-[#ff3b30] text-[13px]">
              {state.error}
            </div>
          )}
          <form action={action} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Email</label>
              <input name="email" type="email" required autoComplete="email" placeholder="tu@email.com" className={inputCls} />
            </div>
            <button type="submit" disabled={pending}
              className="w-full py-3 bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold rounded-xl text-[14px] transition-all mt-1">
              {pending ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
