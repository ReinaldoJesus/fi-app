/**
 * Clarifi "C" filling up with water: the loading indicator used for sign-in
 * and while dashboard screens load. Pure SVG + CSS, so it works in server
 * components and starts animating before any JS runs.
 */
const C_PATH = "M17 6a8 8 0 1 0 0 12"
// Wave wider than the box so it can scroll sideways seamlessly (period 12).
const WAVE =
  "M-24 2Q-21 0-18 2T-12 2T-6 2T0 2T6 2T12 2T18 2T24 2T30 2T36 2T42 2T48 2V40H-24Z"

export function BrandLoader({ size = 64 }: { size?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="brand-loader rounded-[28%] flex items-center justify-center bg-[#1d1d1f] dark:bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" aria-hidden>
        <defs>
          <mask id="clarifi-c-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <path d={C_PATH} stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
          </mask>
        </defs>
        {/* Empty glass */}
        <path d={C_PATH} strokeWidth={3.2} strokeLinecap="round" className="stroke-white/20 dark:stroke-black/15" />
        {/* Water */}
        <g mask="url(#clarifi-c-mask)">
          <g className="brand-loader-level">
            <path d={WAVE} className="brand-loader-wave fill-[#0a84ff]" opacity={0.55} style={{ animationDuration: "1.7s", animationDirection: "reverse" }} />
            <path d={WAVE} className="brand-loader-wave fill-[#0a84ff]" transform="translate(0 0.6)" />
          </g>
        </g>
      </svg>
    </div>
  )
}

/** Full-screen loading state: logo + caption, centered. */
export function LoadingScreen({ label = "Cargando tus finanzas…", overlay = false }: { label?: string; overlay?: boolean }) {
  return (
    <div
      className={`${overlay ? "fixed inset-0 z-[1000] bg-[#f2f2f7]/85 dark:bg-black/85 backdrop-blur-md anim-fade-in" : "min-h-screen bg-[#f2f2f7] dark:bg-black"} flex flex-col items-center justify-center gap-5 px-6`}
    >
      <BrandLoader size={72} />
      <p className="text-[14px] font-medium text-[#86868b] brand-loader-caption">{label}</p>
    </div>
  )
}
