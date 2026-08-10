import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Sheet } from '@/Components/primitives/Sheet'
import { UI_TIMING } from '../../Utilities/constants'

/**
 * Body crossfade for the unified mobile admin sheet. The Sheet vessel (and its
 * header) stay mounted; only the BODY morphs between screens. On a
 * `transitionKey` change it freezes the outgoing body, fades it out, swaps in
 * the incoming body, then fades that in — so inbox → detail and detail → detail
 * read as one continuous surface instead of separate sheets sliding up/down.
 * Same-key re-renders (edit-mode toggles, async data) pass straight through with
 * no fade. Flash-free: the fade-out is armed synchronously on the key-change
 * render, so the incoming screen never paints at full opacity before the
 * outgoing one dissolves.
 */
function MorphSheetBody({
    transitionKey,
    children,
    duration = UI_TIMING.SHEET_MORPH,
}: {
    transitionKey: string
    children: ReactNode
    duration?: number
}) {
    const [committedKey, setCommittedKey] = useState(transitionKey)
    const [fading, setFading] = useState(false)
    const [frozen, setFrozen] = useState<ReactNode>(null)
    const liveNode = useRef<ReactNode>(children)

    // Retain the latest body while the key is stable so the NEXT transition
    // freezes the correct OUTGOING screen — not the incoming one that already
    // flowed in on the key-change render.
    if (!fading && transitionKey === committedKey) liveNode.current = children

    // Key changed → arm the fade-out during render. Doing it here (not in an
    // effect) means the incoming screen never paints a frame at full opacity
    // before the outgoing one dissolves.
    if (transitionKey !== committedKey && !fading) {
        setFrozen(liveNode.current)
        setFading(true)
    }

    useEffect(() => {
        if (!fading) return
        const t = window.setTimeout(() => {
            setCommittedKey(transitionKey)
            setFrozen(null)
            setFading(false)
        }, duration)
        return () => window.clearTimeout(t)
    }, [fading, transitionKey, duration])

    return (
        <div
            className="transition-opacity ease-out"
            style={{ opacity: fading ? 0 : 1, transitionDuration: `${duration}ms` }}
        >
            {fading ? frozen : children}
        </div>
    )
}

interface AdminMobileSheetProps {
    isOpen: boolean
    /** Identity of the shown detail — `null` means the inbox is showing. Must
     *  include the entity id (`user:abc`), not just the kind, so a same-type hop
     *  (user A → user B) still reads as a screen change and crossfades. */
    screenId: string | null
    detailTitle: string
    /** Detail title with its breadcrumb trail. Ignored on the inbox screen. */
    titleNode: ReactNode
    /** Header actions published by the active detail, if any. */
    detailActions: ReactNode
    /** True when `detailActions` REPLACES the Sheet's Close (triage details), so
     *  the sheet must supply a back affordance of its own. */
    detailOwnsHeaderActions: boolean
    backButton: ReactNode
    onClose: () => void
    children: ReactNode
}

/**
 * The mobile admin surface: ONE sheet vessel hosting the inbox rail AND every
 * detail screen.
 *
 * These used to be separate <Sheet>s, so moving between them slid one down and
 * the other up ("all different sheets"). Here the sheet stays mounted and only
 * its body morphs, so inbox ⇄ detail and detail ⇄ detail read as a single
 * continuous surface.
 *
 * Portals to body (z-1200) to clear the mobileFullScreen drawer (z-60) — matches
 * the overlay-sheet convention (Property/Map). A dimming scrim separates
 * figure/ground since the list shares the drawer bg; tap scrim, header Close, or
 * drag to dismiss.
 */
export function AdminMobileSheet({
    isOpen,
    screenId,
    detailTitle,
    titleNode,
    detailActions,
    detailOwnsHeaderActions,
    backButton,
    onClose,
    children,
}: AdminMobileSheetProps) {
    const showsInbox = screenId === null

    // Hold the last screen while the sheet slides closed, so a dismiss doesn't
    // trigger a spurious crossfade on the way down.
    const lastKey = useRef('inbox')
    const key = screenId ?? (isOpen ? 'inbox' : lastKey.current)
    lastKey.current = key

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            height="fit"
            // 88, not 70: this one sheet hosts every mobile detail including the
            // full user form, and mobile is held at full parity — a 70%-tall
            // sheet with the keyboard up left nothing to edit in.
            maxHeight={88}
            backdrop="dismiss"
            title={showsInbox ? 'Inbox' : detailTitle}
            titleNode={showsInbox ? undefined : titleNode}
            leftContent={!showsInbox && detailOwnsHeaderActions ? backButton : undefined}
            rightContent={showsInbox ? undefined : detailActions}
            hideClose={showsInbox ? false : !!detailActions}
            zIndex={1200}
        >
            <MorphSheetBody transitionKey={key}>{children}</MorphSheetBody>
        </Sheet>
    )
}
