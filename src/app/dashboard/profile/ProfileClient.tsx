"use client"
import { useActionState, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { api } from "@/lib/api/client"
import { useSession } from "next-auth/react"
import ProviderBadge, { PROVIDER_LABEL } from "@/components/ProviderBadge"
import { LoadingScreen } from "@/components/BrandLoader"
import { logout } from "@/app/actions/auth"
import PushSettings from "./PushSettings"
import ShortcutsSettings from "./ShortcutsSettings"
import { COUNTRIES, countryOf } from "@/lib/countries"

type Account = { id: string; name: string }

type Settings = {
  budgetCarryOver: boolean
  notifSubscriptions: boolean
  notifInactivity: boolean
  notifBudget: boolean
  hideAmountsOnStart: boolean
  defaultAccountId: string | null
  country: string | null
}

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white placeholder-[#c7c7cc] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-[14px] transition-all"
const labelCls = "block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5"
const card = "bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.09] dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none p-6"

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] ${
        checked ? "bg-[#34c759]" : "bg-[#e5e5ea] dark:bg-[#3a3a3c]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  )
}

function SettingRow({ label, description, checked, onChange, saving }: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  saving?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white">{label}</p>
        {description && <p className="text-[12px] text-[#86868b] mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={saving} />
    </div>
  )
}

export default function ProfileClient({
  initialSettings,
  accounts,
  hasPassword,
}: {
  initialSettings: Settings
  accounts: Account[]
  /** From the server: whether the account can sign in with email + password. */
  hasPassword: boolean
}) {
  const { data: session, update } = useSession()
  const [showPassword, setShowPassword] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [, startSave] = useTransition()

  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim()
    const currentPassword = String(formData.get("currentPassword") ?? "")
    const newPassword = String(formData.get("newPassword") ?? "")

    if (name) {
      const r = await api.me.update({ name })
      if (r.error) return { error: r.error }
    }
    if (newPassword) {
      const r = await api.me.changePassword({ currentPassword, newPassword })
      if (r.error) return { error: r.error }
    }
    await update()
    return { success: "Cambios guardados correctamente" }
  }, undefined)

  const user = session?.user
  const initial = (user?.name ?? user?.email ?? "U")[0].toUpperCase()

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    setSettingsSaved(false)
    startSave(async () => {
      await api.me.update({ [key]: value })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    })
  }

  return (
    <div className="max-w-xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">

      <h1 className="text-[26px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">Perfil</h1>

      {/* Avatar */}
      <div className={`${card} flex items-center gap-4`}>
        {user?.image ? (
          <div className="relative flex-shrink-0">
            <img src={user.image} alt="" className="w-16 h-16 rounded-full" />
            <ProviderBadge provider={user.provider} size={24} ringClass="ring-white dark:ring-[#1c1c1e]" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#1d1d1f] dark:bg-white flex items-center justify-center text-white dark:text-[#1d1d1f] text-2xl font-semibold flex-shrink-0">
            {initial}
          </div>
        )}
        <div>
          <p className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">{user?.name ?? "—"}</p>
          <p className="text-[13px] text-[#86868b] mt-0.5">{user?.email}</p>
          {(user?.provider === "google" || user?.provider === "github") ? (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-[#86868b] bg-[#f5f5f7] dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
              Sesión iniciada con {PROVIDER_LABEL[user.provider]}
            </span>
          ) : user?.image ? (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-[#86868b] bg-[#f5f5f7] dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
              Cuenta social
            </span>
          ) : null}
        </div>
      </div>

      {/* Feedback */}
      {state?.success && (
        <div className="px-4 py-3 rounded-xl bg-[#34c759]/10 border border-[#34c759]/20 text-[#34c759] text-[13px] font-medium">
          {state.success}
        </div>
      )}
      {state?.error && (
        <div className="px-4 py-3 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#ff3b30] text-[13px]">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-5">

        {/* Name */}
        <div className={card}>
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white mb-4">Información personal</h2>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input name="name" type="text" defaultValue={user?.name ?? ""} placeholder="Tu nombre" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={user?.email ?? ""} readOnly
                className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#86868b] text-[14px] cursor-not-allowed" />
              <p className="text-[11px] text-[#86868b] mt-1.5">El email no se puede cambiar</p>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className={card}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Contraseña</h2>
            {hasPassword && (
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="text-[13px] text-[#007aff] font-medium hover:opacity-70 transition-opacity">
                {showPassword ? "Cancelar" : "Cambiar"}
              </button>
            )}
          </div>

          {!hasPassword ? (
            <p className="text-[13px] text-[#86868b]">
              Entras con una cuenta social, así que no tienes contraseña en Clarifi.{" "}
              <Link href="/forgot-password" className="text-[#007aff] font-medium hover:opacity-70">Crear una contraseña</Link>
            </p>
          ) : showPassword ? (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Contraseña actual</label>
                <input name="currentPassword" type="password" placeholder="••••••••" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nueva contraseña</label>
                <input name="newPassword" type="password" placeholder="Mínimo 8 caracteres" className={inputCls} />
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#86868b]">••••••••••••</p>
          )}
        </div>

        <button type="submit" disabled={pending}
          className="w-full py-3 bg-[#1d1d1f] dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-[#1d1d1f] font-semibold rounded-xl text-[14px] transition-all">
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* Settings */}
      <div className={card}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Ajustes</h2>
          {settingsSaved && (
            <span className="text-[11px] font-semibold text-[#34c759]">Guardado</span>
          )}
        </div>
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.05]">
          <PushSettings />
          <SettingRow
            label="Traer presupuestos automáticamente"
            description="Copia el mes anterior al abrir un mes sin presupuestos."
            checked={settings.budgetCarryOver}
            onChange={v => updateSetting("budgetCarryOver", v)}
          />
          <SettingRow
            label="Notificaciones de suscripciones"
            description="Avisa cuando un cobro se acerca en los próximos 3 días."
            checked={settings.notifSubscriptions}
            onChange={v => updateSetting("notifSubscriptions", v)}
          />
          <SettingRow
            label="Alertas de presupuesto"
            description="Avisa cuando una categoría llega al 90% de su presupuesto del mes."
            checked={settings.notifBudget}
            onChange={v => updateSetting("notifBudget", v)}
          />
          <SettingRow
            label="Notificaciones de inactividad"
            description="Avisa si no has registrado movimientos en el día."
            checked={settings.notifInactivity}
            onChange={v => updateSetting("notifInactivity", v)}
          />
          <SettingRow
            label="Ocultar montos al iniciar"
            description="Los importes se muestran como ••• por defecto hasta que los actives."
            checked={settings.hideAmountsOnStart}
            onChange={v => updateSetting("hideAmountsOnStart", v)}
          />

          {/* Country: drives suggested banks, currency and quick amounts */}
          <div className="py-3.5">
            <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white mb-0.5">País</p>
            <p className="text-[12px] text-[#86868b] mb-3">Sugerimos bancos y moneda de {countryOf(settings.country).name} al crear cuentas.</p>
            <select
              value={settings.country ?? ""}
              onChange={e => updateSetting("country", e.target.value || null)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
            >
              {!settings.country && <option value="">Elige tu país</option>}
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.currency})</option>)}
            </select>
          </div>

          {/* Default account */}
          {accounts.length > 0 && (
            <div className="py-3.5">
              <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white mb-0.5">Cuenta predeterminada</p>
              <p className="text-[12px] text-[#86868b] mb-3">Se preselecciona al crear una nueva transacción.</p>
              <select
                value={settings.defaultAccountId ?? ""}
                onChange={e => updateSetting("defaultAccountId", e.target.value || null)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent text-[#1d1d1f] dark:text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              >
                <option value="">Sin preferencia</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <ShortcutsSettings />

      <YourData hasPassword={hasPassword} />

      <p className="text-center text-[12px] text-[#86868b] pb-2">
        <Link href="/privacy" className="hover:text-[#007aff]">Política de privacidad</Link>
        {" · "}
        <Link href="/terms" className="hover:text-[#007aff]">Términos de uso</Link>
      </p>
    </div>
  )
}

/** "Tus datos": download everything, or permanently delete the account. */
function YourData({ hasPassword }: { hasPassword: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<{ message?: string; fields?: Record<string, string[]> }>({})
  const [deleting, setDeleting] = useState(false)

  async function onDelete(form: FormData) {
    setError({})
    setDeleting(true)
    const r = await api.me.remove({
      confirm: String(form.get("confirm") ?? "") as "ELIMINAR",
      password: String(form.get("password") ?? "") || undefined,
    })
    if (!r.ok) {
      setDeleting(false)
      setError({ message: r.fields ? undefined : r.error, fields: r.fields })
      return
    }
    await logout()
  }

  return (
    <div className={card}>
      {deleting && <LoadingScreen overlay label="Eliminando tu cuenta…" />}
      <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white mb-1">Tus datos</h2>
      <p className="text-[13px] text-[#86868b] mb-4">Tus datos son tuyos: puedes llevártelos o borrarlos cuando quieras.</p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <a href={api.me.exportUrl} download
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[13px] font-semibold text-[#1d1d1f] dark:text-white hover:opacity-80 transition-opacity">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Descargar mis datos
        </a>
        <button type="button" onClick={() => { setError({}); dialogRef.current?.showModal() }}
          className="flex-1 py-2.5 rounded-xl border border-[#ff3b30]/25 text-[13px] font-semibold text-[#ff3b30] hover:bg-[#ff3b30]/[0.06] transition-colors">
          Eliminar mi cuenta
        </button>
      </div>

      <dialog ref={dialogRef}
        className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-black/[0.08] dark:border-white/[0.08] backdrop:bg-black/40 open:flex open:flex-col m-auto"
        onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close() }}>
        <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">¿Eliminar tu cuenta?</h3>
        <p className="text-[13px] text-[#86868b] mt-1.5 mb-4 leading-relaxed">
          Se borrarán para siempre tus cuentas, movimientos, presupuestos, metas, suscripciones y boletas.
          <strong className="text-[#1d1d1f] dark:text-white"> No se puede deshacer.</strong> Si quieres, descarga tus datos antes.
        </p>
        <form action={onDelete} className="space-y-3">
          {error.message && <p className="text-[12px] text-[#ff3b30]">{error.message}</p>}
          <div>
            <label className={labelCls}>Escribe ELIMINAR para confirmar</label>
            <input name="confirm" required autoComplete="off" placeholder="ELIMINAR" className={inputCls} />
            {error.fields?.confirm && <p className="text-[12px] text-[#ff3b30] mt-1">{error.fields.confirm[0]}</p>}
          </div>
          {hasPassword && (
            <div>
              <label className={labelCls}>Tu contraseña</label>
              <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className={inputCls} />
              {error.fields?.password && <p className="text-[12px] text-[#ff3b30] mt-1">{error.fields.password[0]}</p>}
            </div>
          )}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={() => dialogRef.current?.close()}
              className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white text-[13px] font-semibold hover:opacity-80">
              Cancelar
            </button>
            <button type="submit" disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-[#ff3b30] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              Eliminar para siempre
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
