import { BrandLoader } from "@/components/BrandLoader"

// Shown inside the app shell (sidebar stays) while a dashboard screen loads.
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[60vh] anim-fade-in">
      <BrandLoader size={56} />
      <p className="text-[13px] font-medium text-[#86868b] brand-loader-caption">Cargando…</p>
    </div>
  )
}
