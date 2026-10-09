import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Sheet } from '@/Components/primitives/Sheet'
import { UI_TIMING } from '../../Utilities/constants'

/**
 * Body crossfade for the unified mobile admin sheet. The Sheet vessel (and its
 * header) stay mounted; only the BODY morphs between screens. On a
 * `transitionKey` change it freezes the outgoing body, fades it out, swaps in
 * the incoming body, then fades that in — so detail → detail hops read as one
 * continuous surface instead of separate sheets sliding up/down.
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
    /** Identity of the shown detail (`user:abc`) — must carry the entity id, not
     *  just the kind, so a same-type hop (user A → user B) still crossfades. */
    screenId: string | null
    title: string
    /** Title with its breadcrumb trail stacked above. */
    titleNode: ReactNode
    /** Header pills published by the active detail. The sheet's Close stays. */
    actions: ReactNode
    onClose: () => void
    children: ReactNode
}

/**
 * The mobile admin detail surface: ONE sheet vessel hosting every detail. The
 * vessel and header stay mounted and only the body morphs, so detail ⇄ detail
 * hops read as one continuous surface rather than sheets sliding down and up.
 * Portals to body (z-1200) to clear the mobileFullScreen drawer.
 */
export function AdminMobileSheet({ isOpen, screenId, title, titleNode, actions, onClose, children }: AdminMobileSheetProps) {
    // Hold the last screen while the sheet slides closed, so a dismiss doesn't
    // trigger a spurious crossfade on the way down.
    const lastKey = useRef('')
    const key = screenId ?? lastKey.current
    lastKey.current = key

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            height="fit"
            // 88, not 70: this sheet hosts the full user form, and with the
            // keyboard up a 70%-tall sheet left nothing to edit in.
            maxHeight={88}
            backdrop="dismiss"
            title={title}
            titleNode={titleNode}
            rightContent={actions}
            zIndex={1200}
        >
            <MorphSheetBody transitionKey={key}>{children}</MorphSheetBody>
        </Sheet>
    )
}
