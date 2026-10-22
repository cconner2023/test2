/**
 * ProvisionalDeviceModal — the install surface for browser tabs.
 *
 * Appears when deviceRole === 'provisional' (browser tab, not an installed PWA).
 * Replaces the standalone InstallPrompt. History lives in the Vault regardless of
 * device, so this only pitches install, conditionally rendering —
 *   • desktop / Android (beforeinstallprompt captured) → one-tap Install button
 *   • iOS                                              → Add-to-Home-Screen hint
 *   • neither                                          → generic PWA-install copy
 * Dismissible once per session (sessionStorage).
 */

import { useState, useCallback, useEffect } from 'react'
import { Download, Share } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInstallCapability } from '../../Hooks/useInstallPrompt'
import { Modal } from '@/Components/primitives/Modal'

const DISMISS_KEY = '_provisional_modal_dismissed'

export function ProvisionalDeviceModal() {
  const deviceRole = useAuthStore(s => s.deviceRole)
  const { isIOS, canInstall, install, isInstalling } = useInstallCapability()

  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  const dismiss = useCallback(() => {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }, [])

  const isOpen = deviceRole === 'provisional' && !dismissed

  const handleInstall = useCallback(async () => {
    await install()
    dismiss()
  }, [install, dismiss])

  return (
    <Modal isOpen={isOpen} onClose={dismiss} hideClose maxWidth={400}>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-themeblue2/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-themeblue2" />
          </div>
          <h3 className="text-sm font-semibold text-primary">Install the App</h3>
        </div>

        {/* Install affordance — conditional on platform / install support */}
        {canInstall ? (
          <p className="text-[10pt] text-tertiary leading-relaxed">
            Install the app for persistent, real-time messaging on this device.
          </p>
        ) : isIOS ? (
          <p className="text-[10pt] text-tertiary leading-relaxed">
            For persistent, real-time messaging, install the app: tap{' '}
            <Share className="inline h-3.5 w-3.5 text-themeblue2 -mt-0.5" /> in your browser
            toolbar, then <span className="font-medium text-primary">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="text-[10pt] text-tertiary leading-relaxed">
            For persistent, real-time messaging, install the app as a PWA (Add to Home Screen).
          </p>
        )}

        {canInstall ? (
          <div className="flex items-center gap-2.5 mt-1">
            <button
              onClick={dismiss}
              className="flex-1 py-2 rounded-full bg-themewhite2 text-tertiary text-sm font-medium hover:bg-themegray1/40 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1 py-2 rounded-full bg-primary text-themewhite text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isInstalling ? (
                <><Download className="h-3.5 w-3.5 animate-bounce" /> Installing…</>
              ) : (
                <><Download className="h-3.5 w-3.5" /> Install</>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={dismiss}
            className="mt-1 w-full py-2 rounded-full bg-primary text-themewhite text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        )}
      </div>
    </Modal>
  )
}
