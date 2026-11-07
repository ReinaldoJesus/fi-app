"use client"
import { useEffect, useSyncExternalStore } from "react"

/** Registers /sw.js (production only, so local development never serves stale pages). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
  }, [])
  return null
}

/** On the login screen: drop cached app pages so a signed-out device keeps no financial data. */
export function ClearOfflinePages() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.ready.then(reg => reg.active?.postMessage({ type: "clear-pages" })).catch(() => {})
    // Also clear directly in case the worker isn't active yet.
    if ("caches" in window) {
      caches.keys().then(keys => keys.filter(k => k.startsWith("clarifi-pages-")).forEach(k => caches.delete(k))).catch(() => {})
    }
  }, [])
  return null
}

function subscribe(cb: () => void) {
  window.addEventListener("online", cb)
  window.addEventListener("offline", cb)
  return () => {
    window.removeEventListener("online", cb)
    window.removeEventListener("offline", cb)
  }
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

/** Thin banner shown in the app while the device has no connection. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="sticky top-0 z-[300] bg-[#ff9500] text-white text-[12px] font-semibold text-center px-4 py-1.5 anim-fade-in">
      Sin conexión · Estás viendo datos guardados; los cambios no se guardarán hasta que vuelva la señal.
    </div>
  )
}
