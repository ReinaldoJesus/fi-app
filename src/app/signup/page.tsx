"use client"
import { useActionState } from "react"
import Link from "next/link"
import AuthShell from "@/components/AuthShell"
import { signup } from "@/app/actions/auth"
import { LoadingScreen } from "@/components/BrandLoader"

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px] transition-all"

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <AuthShell
      title="Abre tu cuenta"
      subtitle="Crea tu banca personal Clarifi en menos de un minuto."
      footer={
        <p className="text-center text-[#86868b] text-[13px]">
          ¿Ya eres cliente?{" "}
          <Link href="/login" className="text-[#007aff] font-medium hover:opacity-70 transition-opacity">Inicia sesión</Link>
        </p>
      }
    >
          {pending && <LoadingScreen overlay label="Creando tu cuenta…" />}

          {state?.message && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff3b30]/[0.08] border border-[#ff3b30]/20 text-[#ff3b30] text-[13px]">
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
            <p className="text-[11px] text-[#86868b] text-center leading-relaxed">
              Al crear tu cuenta aceptas los{" "}
              <Link href="/terms" className="text-[#007aff] hover:opacity-70">Términos de uso</Link> y la{" "}
              <Link href="/privacy" className="text-[#007aff] hover:opacity-70">Política de privacidad</Link>.
            </p>
          </form>
    </AuthShell>
  )
}
