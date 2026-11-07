"use client"
import { use, useActionState } from "react"
import Link from "next/link"
import AuthShell from "@/components/AuthShell"
import { loginWithCredentials, loginWithGitHub, loginWithGoogle } from "@/app/actions/auth"
import { LoadingScreen } from "@/components/BrandLoader"
import SubmitOverlay from "@/components/SubmitOverlay"

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px] transition-all"

export default function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = use(searchParams)
  const [state, action, pending] = useActionState(loginWithCredentials, undefined)

  return (
    <AuthShell title="Iniciar sesión" subtitle="Ingresa a tu banca personal Clarifi.">
          {pending && <LoadingScreen overlay label="Iniciando sesión…" />}

          {reset && !state?.error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#34c759]/[0.1] border border-[#34c759]/25 text-[#248a3d] dark:text-[#30d158] text-[13px]">
              Contraseña actualizada. Ya puedes iniciar sesión.
            </div>
          )}

          {state?.error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff3b30]/[0.08] border border-[#ff3b30]/20 text-[#ff3b30] text-[13px]">
              {state.error}
            </div>
          )}

          <form action={action} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Email</label>
              <input name="email" type="email" required placeholder="tu@email.com" className={inputCls} />
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Contraseña</label>
                <Link href="/forgot-password" className="text-[12px] text-[#007aff] font-medium hover:opacity-70 transition-opacity">¿La olvidaste?</Link>
              </div>
              <input name="password" type="password" required placeholder="••••••••" className={inputCls} />
            </div>
            <button type="submit" disabled={pending}
              className="w-full py-3 bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold rounded-xl text-[14px] transition-all mt-1">
              {pending ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <Link href="/signup"
            className="mt-2.5 w-full flex items-center justify-center py-3 bg-[#f5f5f7] dark:bg-white/[0.06] hover:opacity-80 text-[#1d1d1f] dark:text-white font-semibold rounded-xl text-[14px] transition-all">
            Crear cuenta
          </Link>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/[0.06] dark:border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-[#1c1c1e] px-3 text-[12px] text-[#86868b]">o continuar con</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <form action={loginWithGoogle}>
              <SubmitOverlay label="Conectando con Google…" />
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#f5f5f7] dark:bg-white/[0.06] hover:opacity-80 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-white transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
            </form>
            <form action={loginWithGitHub}>
              <SubmitOverlay label="Conectando con GitHub…" />
              <button type="submit" className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#f5f5f7] dark:bg-white/[0.06] hover:opacity-80 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-white transition-all">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </button>
            </form>
          </div>
    </AuthShell>
  )
}
