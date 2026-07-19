import { useEffect, useRef } from 'react'

/**
 * Desktop layered Esc back-out.
 *
 * useDesktopHotkeys (the global Esc handler) fires a cancelable `hotkey:esc`
 * window event BEFORE it closes the active drawer, precisely so a drawer can step
 * back through its OWN internal views first (see useDesktopHotkeys.ts:14-20).
 *
 * This hook wires one such step: while `active` (e.g. a right detail pane is open),
 * it swallows the Esc (`preventDefault`) and runs `onBack` instead of letting the
 * drawer close. When `active` is false the event passes through untouched and Esc
 * closes the whole drawer as before. Net feel across the split-pane drawers:
 * first Esc collapses the detail pane, second Esc closes the drawer.
 *
 * Desktop-only by construction — `hotkey:esc` is only dispatched on the desktop
 * layout — but callers still AND in `!isMobile` so the listener isn't attached at
 * all on mobile.
 */
export function useEscBackout(active: boolean, onBack: () => void) {
    const onBackRef = useRef(onBack)
    onBackRef.current = onBack
    useEffect(() => {
        if (!active) return
        const handler = (e: Event) => {
            e.preventDefault()
            onBackRef.current()
        }
        window.addEventListener('hotkey:esc', handler)
        return () => window.removeEventListener('hotkey:esc', handler)
    }, [active])
}
