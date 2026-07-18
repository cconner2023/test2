import { useEffect, useRef } from 'react'
import { useNavigationStore, type NavigationStore } from '../stores/useNavigationStore'
import type { AccessLevel } from '../Types/CatTypes'

/**
 * Desktop keyboard hotkeys. Users asked for keyboard-driven navigation on the
 * desktop layout; this installs a single window keydown listener that is only
 * active when `!isMobile` (mobile has no physical keyboard to speak of).
 *
 * Two behaviours:
 *  1. Ctrl+Alt+<letter> jumps straight to a drawer / section — reuses the exact
 *     dispatch that the SideNav menu uses (`handleMenuItemClick`) so gating,
 *     deep-links and CLOSE_ALL_DRAWERS mutual-exclusivity all come for free.
 *  2. Esc "backs out" ONE overlay layer — it is deliberately NOT a home button.
 *     Order: menu → write-note → open drawer → ADTMC back. Never resets to main.
 *
 * Esc first dispatches a cancelable `hotkey:esc` window event: a drawer that
 * wants to step back through its OWN internal views before closing can listen
 * and call preventDefault() to swallow the Esc. Nothing consumes it today, so
 * the default single-layer back-out applies to every drawer.
 */

/** Ctrl+Alt+<code> → SideNav action. Keyed by KeyboardEvent.code (layout-stable). */
const KEY_TO_ACTION: Record<string, string> = {
    KeyI: 'import',        // Import Note
    KeyK: 'knowledgebase', // Knowledge Base
    KeyM: 'messages',      // Messages
    KeyP: 'property',      // Property Book
    KeyR: 'provider',      // pRovider
    KeyU: 'supervisor',    // sUpervisor
    KeyA: 'admin',         // Admin
    KeyO: 'mapOverlay',    // map Overlay
    KeyT: 'tc3',           // TC3
    KeyC: 'calendar',      // Calendar
    KeyS: 'settings',      // Settings
}

/** Access level required per action — mirrors menuData in Data/CatData.ts. */
const ACTION_ACCESS: Record<string, AccessLevel> = {
    import: 'public',
    knowledgebase: 'public',
    messages: 'authenticated',
    property: 'authenticated',
    provider: 'provider',
    supervisor: 'supervisor',
    admin: 'admin',
    mapOverlay: 'authenticated',
    tc3: 'public',
    calendar: 'authenticated',
    settings: 'public',
}

/** Ordered drawer flag → close action. Drawers are mutually exclusive, so the
 *  first open one is the single overlay layer Esc pops back out of. */
const DRAWER_CLOSERS: [keyof NavigationStore, (n: NavigationStore) => void][] = [
    ['showSettings', (n) => n.setShowSettings(false)],
    ['showKnowledgeBase', (n) => n.setShowKnowledgeBase(false)],
    ['showSymptomInfo', (n) => n.setShowSymptomInfo(false)],
    ['showTrainingDrawer', (n) => n.setShowTrainingDrawer(null)],
    ['showMessagesDrawer', (n) => { n.setShowMessagesDrawer(false); n.clearMessagesConversation() }],
    ['showPropertyDrawer', (n) => n.setShowPropertyDrawer(false)],
    ['showTC3Drawer', (n) => n.setShowTC3Drawer(false)],
    ['showMapOverlayDrawer', (n) => n.setShowMapOverlayDrawer(false)],
    ['showCalendarDrawer', (n) => n.setShowCalendarDrawer(false)],
    ['showAdminDrawer', (n) => n.setShowAdminDrawer(false)],
    ['showSupervisorDrawer', (n) => n.setShowSupervisorDrawer(false)],
    ['showProviderDrawer', (n) => n.setShowProviderDrawer(false)],
    ['showUserGuideDrawer', (n) => n.setShowUserGuideDrawer(false)],
    ['showLoRaDrawer', (n) => n.setShowLoRaDrawer(false)],
]

/** True when focus sits in a text-entry surface — hotkeys must not hijack typing. */
function isEditableTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return el.isContentEditable
}

export interface DesktopHotkeyContext {
    isMobile: boolean
    isAuthenticated: boolean
    isProviderRole: boolean
    isSupervisorRole: boolean
    isDevRole: boolean
    /** SideNav action dispatcher (App's handleMenuItemClick). */
    dispatch: (action: string) => void
}

export function useDesktopHotkeys(ctx: DesktopHotkeyContext) {
    // Keep the latest context in a ref so the listener never needs re-binding
    // (and never fires against stale role flags / dispatch closures).
    const ctxRef = useRef(ctx)
    ctxRef.current = ctx

    useEffect(() => {
        if (ctx.isMobile) return

        const canAccess = (action: string): boolean => {
            const c = ctxRef.current
            switch (ACTION_ACCESS[action]) {
                case 'public': return true
                case 'authenticated': return c.isAuthenticated
                case 'provider': return c.isProviderRole
                case 'supervisor': return c.isSupervisorRole
                case 'admin': return c.isDevRole
                default: return false
            }
        }

        const escBack = () => {
            // Let a drawer swallow Esc to step through its own internal views first.
            const ev = new CustomEvent('hotkey:esc', { cancelable: true })
            window.dispatchEvent(ev)
            if (ev.defaultPrevented) return

            const n = useNavigationStore.getState()
            if (n.isMenuOpen) { n.closeMenu(); return }
            if (n.isWriteNoteVisible) { n.closeWriteNote(); return }
            for (const [flag, close] of DRAWER_CLOSERS) {
                if (n[flag]) { close(n); return }
            }
            // No overlay open — pop one level of the ADTMC column navigation.
            n.handleBackClick()
        }

        const handler = (e: KeyboardEvent) => {
            if (e.repeat) return

            if (e.key === 'Escape') {
                if (isEditableTarget(e.target)) return // let the field handle its own Esc
                escBack()
                return
            }

            // Ctrl+Alt+<letter> — no Meta/Shift, and never while typing.
            if (!e.ctrlKey || !e.altKey || e.metaKey || e.shiftKey) return
            if (isEditableTarget(e.target)) return
            const action = KEY_TO_ACTION[e.code]
            if (!action || !canAccess(action)) return
            e.preventDefault()
            ctxRef.current.dispatch(action)
        }

        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [ctx.isMobile])
}
