"use client"
import { use, useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import AuthShell from "@/components/AuthShell"
import { BrandLoader } from "@/components/BrandLoader"
import { api } from "@/lib/api/client"
import { FormAlert, IconInput, SubmitButton } from "@/components/AuthField"

const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"

type State = { error?: string; fields?: Record<string, string[]> } | undefined

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = use(searchParams)
  const router = useRouter()
  const [valid, setValid] = useState<boolean | null>(token ? null : false)

  useEffect(() => {
    if (!token) return
    api.auth.checkResetToken(token).then(r => setValid(r.ok ? r.data.valid : false))
  }, [token])

  const [state, action, pending] = useActionState(async (_: State, form: FormData): Promise<State> => {
    form.set("token", token)
    const r = await api.auth.resetPassword(form)
    if (!r.ok) return { error: r.fields ? undefined : r.error, fields: r.fields }
    router.replace("/login?reset=1")
    return undefined
  }, undefined)

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elige una contraseña segura para tu cuenta Clarifi.">
      {valid === null ? (
        <div className="flex justify-center py-6"><BrandLoader size={48} /></div>
      ) : !valid ? (
        <div className="text-center py-2">
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Este enlace ya no es válido</p>
          <p className="text-[13px] text-[#86868b] mt-1.5">Venció o ya fue usado. Pide uno nuevo y úsalo dentro de 1 hora.</p>
          <Link href="/forgot-password"
            className="mt-5 inline-flex px-5 py-2.5 bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] font-semibold rounded-xl text-[14px]">
            Pedir un enlace nuevo
          </Link>
        </div>
      ) : (
        <>
          {state?.error && (
            <FormAlert key={state.error} tone="error">
              {state.error}{" "}
              <Link href="/forgot-password" className="underline font-medium">Pedir otro</Link>
            </FormAlert>
          )}
          <form action={action} className="space-y-3">
            <div>
              <label className={labelCls}>Nueva contraseña</label>
              <IconInput icon="lock" name="password" type="password" required autoComplete="new-password" placeholder="Mínimo 8, una mayúscula y un número" />
              {state?.fields?.password && <p className="text-[12px] text-[#ff3b30] mt-1">{state.fields.password[0]}</p>}
            </div>
            <div>
              <label className={labelCls}>Repite la contraseña</label>
              <IconInput icon="shield" name="confirmPassword" type="password" required autoComplete="new-password" placeholder="••••••••" />
              {state?.fields?.confirmPassword && <p className="text-[12px] text-[#ff3b30] mt-1">{state.fields.confirmPassword[0]}</p>}
            </div>
            <SubmitButton pending={pending} pendingLabel="Guardando…" className="mt-1">Guardar contraseña</SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  )
}
