import { useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { AnchoredMenu } from './LiftedRowMenu'
import type { ContextMenuItem } from './ContextMenu'

/**
 * Right-header overflow menu for popovers/detail sheets — a single ellipsis that
 * opens an anchored vertical list (AnchoredMenu). Object-level secondary actions
 * (Share, Export, Delete) live here so the footer stays focused on the primary
 * commit. Uses AnchoredMenu (portal @ z-9998) rather than ActionSheet so it layers
 * ABOVE an open PreviewOverlay (Z.POPOVER). Renders nothing when `items` is empty,
 * so callers can pass a conditionally-empty list (new vs. edit mode).
 */
export function OverlayHeaderMenu({ items }: { items: ContextMenuItem[] }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  if (items.length === 0) return null
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setRect(btnRef.current?.getBoundingClientRect() ?? null)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-tertiary active:scale-95 transition-all"
        aria-label="More actions"
      >
        <MoreHorizontal size={16} />
      </button>
      <AnchoredMenu
        isOpen={!!rect}
        anchorRect={rect}
        items={items}
        onClose={() => setRect(null)}
        layout="list"
        align="right"
      />
    </>
  )
}
