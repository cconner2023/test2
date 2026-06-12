// Opening a `mailto:` link reliably from inside the installed PWA / SPA shell.
//
// `window.location.href = 'mailto:…'` navigates the SPA window — which the
// service worker / router intercepts, so the mail client never launches.
// `window.open('mailto:…')` is treated like a popup and is silently blocked.
// An anchor with target="_blank" opens an empty about:blank tab on desktop
// instead of handing off to the mail client.
//
// A plain anchor click (no target) is the reliable form: the browser hands
// `mailto:` to the OS protocol handler without navigating the current page,
// and SPA routers ignore non-http protocols so they don't intercept it.

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
  document.body.appendChild(a)
  a.click()
  a.remove()
}
