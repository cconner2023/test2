/**
 * GitHub Pages can't send X-Frame-Options, and a meta CSP can't carry
 * frame-ancestors, so nothing stops another site framing the app and overlaying
 * its own UI (clickjacking). Entry points call this before rendering anything.
 * A cross-origin window.top throws on access in some engines; treat that as framed.
 */
export function isFramed(): boolean {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}
