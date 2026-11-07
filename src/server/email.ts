import "server-only"

/**
 * Transactional email through Resend's HTTP API (https://resend.com).
 * Env: RESEND_API_KEY, EMAIL_FROM (e.g. "Clarifi <no-reply@tudominio.cl>").
 * Without a key, emails are printed to the server log so local development works.
 */
export type Email = { to: string; subject: string; html: string; text: string }

export const emailConfigured = () => !!process.env.RESEND_API_KEY

export async function sendEmail(msg: Email): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set; email to ${msg.to} not sent.\nSubject: ${msg.subject}\n${msg.text}`)
    return { sent: false }
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Clarifi <onboarding@resend.dev>",
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  })
  if (!res.ok) {
    console.error("[email] Resend error", res.status, await res.text().catch(() => ""))
    return { sent: false }
  }
  return { sent: true }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/** Simple branded layout shared by every email. */
export function emailLayout({ title, intro, cta, footer }: {
  title: string
  intro: string
  cta?: { label: string; url: string }
  footer?: string
}) {
  const html = `<!doctype html><html><body style="margin:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<div style="width:40px;height:40px;border-radius:11px;background:#1d1d1f;color:#fff;font-weight:700;font-size:22px;line-height:40px;text-align:center">C</div>
<h1 style="font-size:22px;margin:24px 0 8px">${esc(title)}</h1>
<p style="font-size:15px;line-height:1.5;color:#3a3a3c;margin:0 0 24px">${esc(intro)}</p>
${cta ? `<a href="${esc(cta.url)}" style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">${esc(cta.label)}</a>
<p style="font-size:12px;color:#86868b;margin:20px 0 0;word-break:break-all">Si el botón no funciona, copia este enlace:<br>${esc(cta.url)}</p>` : ""}
${footer ? `<p style="font-size:12px;color:#86868b;margin:24px 0 0">${esc(footer)}</p>` : ""}
</td></tr></table>
<p style="font-size:11px;color:#86868b;margin-top:16px">Clarifi · Banca personal</p>
</td></tr></table></body></html>`
  const text = [title, "", intro, cta ? `\n${cta.label}: ${cta.url}` : "", footer ? `\n${footer}` : ""].join("\n")
  return { html, text }
}
