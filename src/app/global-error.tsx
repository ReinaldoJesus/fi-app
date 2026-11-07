"use client"
import "./globals.css"
import ErrorView from "@/components/ErrorView"

// Replaces the root layout when it fails, so it brings its own <html>/<body>.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="es">
      <body className="bg-[#f2f2f7] dark:bg-black">
        <title>Algo salió mal · Clarifi</title>
        <ErrorView error={error} retry={unstable_retry} fullScreen />
      </body>
    </html>
  )
}
