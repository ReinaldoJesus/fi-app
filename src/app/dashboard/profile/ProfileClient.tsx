"use client"
import { useActionState, useState, useTransition } from "react"
import { updateProfile } from "@/app/actions/auth"
import { saveSettings } from "@/app/actions/profile"
import { useSession } from "next-auth/react"

type Account = { id: string; name: string }

type Settings = {
  budgetCarryOver: boolean
  notifSubscriptions: boolean
  notifInactivity: boolean
  hideAmountsOnStart: boolean
  defaultAccountId: string | null
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
}: {
  initialSettings: Settings
  accounts: Account[]
}) {
  const { data: session, update } = useSession()
  const [showPassword, setShowPassword] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [, startSave] = useTransition()

  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    const result = await updateProfile(undefined, formData)
    if (result.success) await update()
    return result
  }, undefined)

  const user = session?.user
  const initial = (user?.name ?? user?.email ?? "U")[0].toUpperCase()
  const hasPassword = !user?.image

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    setSettingsSaved(false)
    startSave(async () => {
      await saveSettings({ [key]: value })
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
          <img src={user.image} alt="" className="w-16 h-16 rounded-full" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#1d1d1f] dark:bg-white flex items-center justify-center text-white dark:text-[#1d1d1f] text-2xl font-semibold flex-shrink-0">
            {initial}
          </div>
        )}
        <div>
          <p className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">{user?.name ?? "—"}</p>
          <p className="text-[13px] text-[#86868b] mt-0.5">{user?.email}</p>
          {user?.image && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-[#86868b] bg-[#f5f5f7] dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
              Cuenta social
            </span>
          )}
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
            <p className="text-[13px] text-[#86868b]">Iniciaste sesión con una cuenta social. No puedes cambiar la contraseña.</p>
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

      {/* Danger zone */}
      <div className={`${card} border-[#ff3b30]/20 dark:border-[#ff3b30]/20`}>
        <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white mb-1">Zona de peligro</h2>
        <p className="text-[13px] text-[#86868b] mb-4">Estas acciones son permanentes e irreversibles.</p>
        <button type="button" className="text-[13px] text-[#ff3b30] font-medium hover:opacity-70 transition-opacity">
          Eliminar mi cuenta
        </button>
      </div>
    </div>
  )
}
