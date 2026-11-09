/**
 * Whether the floating WhatsApp button is shown on this device. A per-device
 * convenience, so it lives in localStorage; an event keeps the button and the
 * setting in Perfil in sync without a reload.
 */
const KEY = "clarifi-whatsapp-fab"
export const FAB_EVENT = "clarifi-whatsapp-fab"

export function fabHidden(): boolean {
  try { return localStorage.getItem(KEY) === "hidden" } catch { return false }
}

export function setFabHidden(hidden: boolean) {
  try { if (hidden) localStorage.setItem(KEY, "hidden"); else localStorage.removeItem(KEY) } catch { /* ignore */ }
  window.dispatchEvent(new Event(FAB_EVENT))
}
