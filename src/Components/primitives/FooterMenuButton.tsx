import { useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'

/**
 * Footer-LEFT action whose options live in a lifted menu (AnchoredMenu, list
 * layout) rather than in the pill itself. Wrap it in a `FooterPill`.
 *
 * Use this wherever a footer action is a CHOICE (insert a field / add a step of
 * type X). The alternative — morphing the pill in place into one tile per option
 * — was retired: it reflowed the footer, capped the option count at whatever fit
 * the pill's width, and gave options icons with no labels.
 *
 * `anchorRef` (not a frozen rect) is deliberate: these footers sit under a live
 * text editor, so an iOS keyboard collapse reflows the layout right after the tap
 * and a snapshot would strand the menu.
 *
 * Rolls its own trigger rather than composing `ActionButton` because it needs the
 * element ref to anchor against and the mousedown guard below; the classes track
 * ActionButton's `default` variant.
 */
export function FooterMenuButton({
  icon: Icon, label, items, node, disabled = false,
}: {
  /** Lucide icon — required unless `node` supplies a custom glyph. */
  icon?: LucideIcon
  label: string
  items: ContextMenuItem[]
  /** Custom glyph, winning over `icon` — e.g. the `[ ]` insert-field mark. */
  node?: ReactNode
  disabled?: boolean
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        // Keeps a contenteditable host's selection alive while the menu opens.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          disabled ? 'bg-tertiary/4 text-tertiary cursor-default' : 'bg-themeblue2/8 text-primary active:scale-95'
        }`}
      >
        {node ?? (Icon && <Icon size={16} />)}
      </button>
      <AnchoredMenu
        isOpen={open}
        anchorRect={null}
        anchorRef={btnRef}
        items={items}
        onClose={() => setOpen(false)}
        layout="list"
        align="left"
        direction="up"
      />
    </>
  )
}
