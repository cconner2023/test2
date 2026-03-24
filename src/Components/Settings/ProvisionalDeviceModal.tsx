/**
 * ProvisionalDeviceModal — Warning shown when no primary device exists.
 *
 * Appears when deviceRole === 'provisional' (browser tab without a PWA primary).
 * Warns that messages will be lost when the tab closes.
 * Dismissible once per session (sessionStorage).
 */

import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'

const DISMISS_KEY = '_provisional_modal_dismissed'

export function ProvisionalDeviceModal() {
  const deviceRole = useAuthStore(s => s.deviceRole)

  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  const dismiss = useCallback(() => {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }, [])

  // Tour: auto-dismiss when guided tour opens self-chat
  useEffect(() => {
    window.addEventListener('tour:messaging-dismiss-provisional', dismiss)
    return () => window.removeEventListener('tour:messaging-dismiss-provisional', dismiss)
  }, [dismiss])

  if (deviceRole !== 'provisional' || dismissed) return null

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/40">
      <div className="bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 mx-4 max-w-sm w-full px-6 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-themeyellow/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-themeyellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-primary">No Primary Device</h3>
        </div>

        <p className="text-xs text-tertiary leading-relaxed">
          You're using a browser tab without a primary device. Your encryption keys
          and messages will be <strong>lost when this tab closes</strong>.
        </p>

        <p className="text-xs text-tertiary leading-relaxed">
          For persistent messaging, install the app as a PWA (Add to Home Screen).
        </p>

        <button
          onClick={dismiss}
          className="mt-1 w-full py-2 rounded-lg bg-primary text-themewhite text-sm font-medium hover:opacity-90 transition-opacity"
        >
          I understand
        </button>
      </div>
    </div>
  )
}
