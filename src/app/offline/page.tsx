import type { Metadata } from "next"
import BrandMark from "@/components/BrandMark"
import RetryButton from "./RetryButton"

export const metadata: Metadata = { title: "Sin conexión · Clarifi" }
// Precached by the service worker, so it must not depend on the request.
export const dynamic = "force-static"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[#f2f2f7] dark:bg-black">
      <BrandMark size={56} />
      <h1 className="mt-6 text-[22px] font-semibold text-[#1d1d1f] dark:text-white">Sin conexión</h1>
      <p className="mt-2 text-[14px] text-[#86868b] max-w-xs">
        Esta pantalla aún no está guardada en tu dispositivo. Las que ya abriste se pueden ver sin señal.
      </p>
      <RetryButton />
    </div>
  )
}
