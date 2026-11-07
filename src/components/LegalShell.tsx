import type { ReactNode } from "react"
import Link from "next/link"
import BrandMark from "@/components/BrandMark"

export const LEGAL_UPDATED = "7 de noviembre de 2026"
/** Optional public contact address; set NEXT_PUBLIC_SUPPORT_EMAIL in Vercel. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL

export default function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="max-w-2xl mx-auto px-5 pt-8 flex items-center justify-between">
        <Link href="/login" className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="text-[16px] font-semibold text-[#1d1d1f] dark:text-white">Clarifi</span>
        </Link>
        <nav className="flex gap-4 text-[13px] font-medium">
          <Link href="/privacy" className="text-[#007aff] hover:opacity-70">Privacidad</Link>
          <Link href="/terms" className="text-[#007aff] hover:opacity-70">Términos</Link>
        </nav>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-8">
        <article className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-6 sm:p-9 legal">
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{title}</h1>
          <p className="text-[13px] text-[#86868b] mt-1 mb-6">Última actualización: {LEGAL_UPDATED}</p>
          {children}
        </article>
        <p className="text-center text-[12px] text-[#86868b] mt-6">© 2026 Clarifi · Proyecto piloto</p>
      </main>
    </div>
  )
}

export function Contact() {
  return SUPPORT_EMAIL
    ? <>escríbenos a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></>
    : <>contáctanos por el mismo canal por el que te invitaron al piloto</>
}
