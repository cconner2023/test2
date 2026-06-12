// Opening a `mailto:` link from inside the installed PWA / SPA shell.
//
// The reliable form is a plain `window.location` assignment. `mailto:` is a
// non-http scheme, so the service worker's fetch handler never sees it (Workbox
// only intercepts http/https) and the SPA router ignores it — the browser hands
// it straight to the OS protocol handler without navigating the page.
//
// Forms that DON'T work here and must not be reintroduced:
//   • `window.open('mailto:…')`            → treated as a popup, silently blocked
//   • `<a target="_blank">` click          → opens an empty about:blank tab
//   • a synthetic `document.createElement('a').click()` → never launches the
//     mail client in the installed shell (the regression this replaces)
//
// When a real, user-clicked `<a href={buildMailtoHref(...)}>` is already in the
// markup, prefer letting the native anchor fire (gold standard) over calling
// openMailto from its onClick.

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
  window.location.href = buildMailtoHref(parts)
}
