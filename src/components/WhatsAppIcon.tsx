/** Chat bubble with a phone: the shape people recognise as "WhatsApp". */
export default function WhatsAppIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 2.8a9.2 9.2 0 0 0-7.9 13.9L2.8 21.2l4.6-1.2A9.2 9.2 0 1 0 12 2.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.9 7.6c.2-.4.5-.4.8-.4h.6c.2 0 .4.1.5.4l.8 1.9c.1.2 0 .5-.1.6l-.6.7c-.1.2-.1.4 0 .5.4.7 1 1.4 1.6 1.9.6.5 1.2.9 1.9 1.2.2.1.4 0 .5-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.3.3.6-.1.7-.5 1.6-1.4 1.9-.8.3-2 .2-3.7-.7a11 11 0 0 1-4.3-4.6c-.7-1.4-.6-2.6.1-3.5l.3-.4Z" fill="currentColor" />
    </svg>
  )
}
