// Opening a `mailto:` link from inside the installed PWA / SPA shell.
//
// The ONLY reliable form is a real, user-clicked `<a href={buildMailtoHref(...)}>`
// anchor in the markup. `mailto:` is a non-http scheme, so the service worker's
// fetch handler never sees it (Workbox only intercepts http/https) and the SPA
// router ignores it — the browser hands a genuine anchor click straight to the OS
// protocol handler. On desktop this also lets right-click → "open in new tab" hand
// off to a web mail handler.
//
// Forms that DON'T work and must not be reintroduced:
//   • `window.location.href = 'mailto:…'`   → silently does nothing on desktop
//                                             (the regression this replaces)
//   • `window.open('mailto:…')`             → treated as a popup, silently blocked
//   • `<a target="_blank">` click           → opens an empty about:blank tab
//   • a synthetic `document.createElement('a').click()` → never launches the mailer
//
// For affordances that aren't already anchors (context-menu items, corner action
// pills), set `href` on the ContextMenuItem / ActionButton — both render a real
// anchor when `href` is present. Do NOT call any imperative open helper.

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
