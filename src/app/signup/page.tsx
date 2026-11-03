"use client"
import { useActionState } from "react"
import Link from "next/link"
import { signup } from "@/app/actions/auth"

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px] transition-all"

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1d1d1f] dark:bg-white mb-4">
            <svg className="w-6 h-6 text-white dark:text-[#1d1d1f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" d="M17 6a8 8 0 1 0 0 12" />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Clarifi</h1>
          <p className="text-[#86868b] text-[14px] mt-0.5">Crea tu cuenta gratuita</p>
        </div>

        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_20px_rgba(0,0,0,0.08)] dark:shadow-none p-8">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white mb-6">Crear cuenta</h2>

          {state?.message && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff3b30]/08 border border-[#ff3b30]/20 text-[#ff3b30] text-[13px]">
              {state.message}
            </div>
          )}

          <form action={action} className="space-y-3">
            {[
              { id: "name", label: "Nombre", type: "text", placeholder: "Tu nombre", error: state?.errors?.name?.[0] },
              { id: "email", label: "Email", type: "email", placeholder: "tu@email.com", error: state?.errors?.email?.[0] },
              { id: "password", label: "Contraseña", type: "password", placeholder: "Mínimo 8 caracteres", error: state?.errors?.password?.[0] },
              { id: "confirmPassword", label: "Confirmar contraseña", type: "password", placeholder: "Repite tu contraseña", error: state?.errors?.confirmPassword?.[0] },
            ].map(({ id, label, type, placeholder, error }) => (
              <div key={id}>
                <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">{label}</label>
                <input id={id} name={id} type={type} required placeholder={placeholder} className={inputCls} />
                {error && <p className="mt-1.5 text-[12px] text-[#ff3b30]">{error}</p>}
              </div>
            ))}
            <button type="submit" disabled={pending}
              className="w-full py-3 bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold rounded-xl text-[14px] transition-all mt-1">
              {pending ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="text-center text-[#86868b] text-[13px] mt-5">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-[#007aff] font-medium hover:opacity-70 transition-opacity">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
