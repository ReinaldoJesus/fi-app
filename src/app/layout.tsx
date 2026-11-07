import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import ThemeProvider from "@/components/ThemeProvider"
import { GlobalErrorListener } from "@/components/ErrorView"

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Clarifi · Finanzas personales",
  description: "Gestiona todas tus finanzas en un solo lugar",
  applicationName: "Clarifi",
  manifest: "/manifest.json",
  // iOS "Añadir a pantalla de inicio": opens full screen, without Safari's UI.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Clarifi",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
        <GlobalErrorListener />
      </body>
    </html>
  )
}
