// Opening a `mailto:` link reliably from inside the installed PWA / SPA shell.
//
// `window.location.href = 'mailto:…'` navigates the SPA window — which the
// service worker / router intercepts, so the mail client never launches.
// `window.open('mailto:…')` is treated like a popup and is silently blocked.
// A real anchor click with target="_blank" is the only form the browser hands
// off to the OS protocol handler in every context (desktop + standalone iOS).
//
// This is the programmatic equivalent of the user manually doing
// "right-click → open in new tab" on a mailto anchor, which is the one path
// that has been observed to work.

interface MailtoParts {
  to: string
  subject?: string
  body?: string
}

export function buildMailtoHref({ to, subject, body }: MailtoParts): string {
  const params: string[] = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  return `mailto:${to}${params.length ? `?${params.join('&')}` : ''}`
}

export function openMailto(parts: MailtoParts): void {
  const a = document.createElement('a')
  a.href = buildMailtoHref(parts)
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
