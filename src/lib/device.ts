/**
 * What kind of phone is opening the page, to show only the setup that applies.
 * A browser cannot read the exact iPhone model, so Apple Intelligence support is
 * a best guess from the iOS version and the screen size (CSS px, portrait):
 * some sizes exist only on models that have it, others are shared with older ones.
 */
export type Platform = "ios" | "android" | "desktop"
export type Device = {
  platform: Platform
  /** iOS major.minor as a number (18.1), null elsewhere. */
  iosVersion: number | null
  /** The Shortcuts "Transaction" trigger needs iOS 17+. */
  automation: boolean
  /** Can this iPhone build shortcuts with Apple Intelligence? */
  ai: "yes" | "maybe" | "no"
}

// iPhone 16 Pro / 17 / 17 Pro, 16 Pro Max / 17 Pro Max, iPhone Air: all have Apple Intelligence.
const AI_ONLY = ["402x874", "440x956", "420x912"]
// Shared by models with and without it (15 vs 15 Pro, 15 Plus vs 15 Pro Max, 14 vs 16e…).
const AI_MAYBE = ["393x852", "430x932", "390x844"]

export function detectDevice(): Device {
  if (typeof navigator === "undefined") return { platform: "desktop", iosVersion: null, automation: false, ai: "no" }
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return { platform: "android", iosVersion: null, automation: true, ai: "no" }
  if (!/iPhone|iPod/.test(ua)) return { platform: "desktop", iosVersion: null, automation: true, ai: "maybe" }

  const m = ua.match(/OS (\d+)_(\d+)/)
  const iosVersion = m ? Number(`${m[1]}.${m[2]}`) : null
  const w = Math.min(screen.width, screen.height), h = Math.max(screen.width, screen.height)
  const size = `${w}x${h}`
  const ai = iosVersion !== null && iosVersion < 18.1 ? "no"
    : AI_ONLY.includes(size) ? "yes"
    : AI_MAYBE.includes(size) ? "maybe"
    : "no"
  return { platform: "ios", iosVersion, automation: iosVersion === null || iosVersion >= 17, ai }
}
