import { Pencil, Trash2, X, Check } from 'lucide-react'
import { HeaderPill, PillButton } from '../HeaderPill'

interface DetailHeaderActionsProps {
  editing: boolean
  isCreate: boolean
  canDelete?: boolean
  onCancelEdit: () => void
  onStartEdit: () => void
  onRequestDelete: () => void
  onRequestSave: () => void
  /** When idle (not editing) and on mobile, render a close button instead of nothing. */
  onClose?: () => void
  showCloseWhenIdle?: boolean
  /** Hide the Edit pencil entirely — used when the detail surface uses tap-to-edit-overlay
   *  instead of header-toggled inline editing (e.g. AdminUserDetail). */
  hideEdit?: boolean
}

/**
 * Shared header-pill action cluster for AdminDrawer detail views (user, clinic).
 * Replaces the two near-identical 50-line branches that previously lived inline
 * in AdminDrawer.tsx — behavior identical, single source of truth for the
 * cancel/edit/delete/save reveal pattern.
 */
export function DetailHeaderActions({
  editing,
  isCreate,
  canDelete = true,
  onCancelEdit,
  onStartEdit,
  onRequestDelete,
  onRequestSave,
  onClose,
  showCloseWhenIdle = false,
  hideEdit: hideEditProp = false,
}: DetailHeaderActionsProps) {
  // hideEdit doesn't apply during create — the inline create form still
  // needs the header Save pill until Phase 3 of the overlay conversion.
  const hideEdit = hideEditProp && !isCreate
  return (
    <HeaderPill>
      {/* Cancel — visible when editing (in create mode, back button handles cancel) */}
      {/* grid-template-columns reveal: 1fr ↔ 0fr animates without hardcoded widths,
          so the slot fits any future label/icon padding without manual tuning. */}
      {!isCreate && !hideEdit && (
        <div
          className={
            'grid transition-[grid-template-columns,opacity] duration-200 ease-out ' +
            (editing ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0')
          }
        >
          <div className="overflow-hidden flex items-center">
            <PillButton icon={X} iconSize={18} onClick={onCancelEdit} label="Cancel" />
          </div>
        </div>
      )}

      {/* Edit — visible when NOT editing, hidden in create mode or when hideEdit set
          (tap-to-edit-overlay pattern owns the edit entry point) */}
      {!isCreate && !hideEdit && (
        <div
          className={
            'grid transition-[grid-template-columns,opacity] duration-200 ease-out ' +
            (!editing ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0')
          }
        >
          <div className="overflow-hidden flex items-center">
            <PillButton icon={Pencil} iconSize={18} onClick={onStartEdit} label="Edit" />
          </div>
        </div>
      )}

      {/* Delete — visible when editing existing record (and caller permits it).
          Hidden in hideEdit mode — overlay footer owns delete in that pattern. */}
      {editing && !isCreate && canDelete && !hideEdit && (
        <PillButton icon={Trash2} iconSize={18} onClick={onRequestDelete} label="Delete" />
      )}

      {/* Save when editing; otherwise an optional Close for mobile main-pane parity.
          Save also hidden in hideEdit mode — overlay footer owns save. */}
      {editing && !hideEdit ? (
        <PillButton
          icon={Check}
          iconSize={18}
          circleBg="bg-themegreen text-white"
          onClick={onRequestSave}
          label="Save"
        />
      ) : (!editing || hideEdit) && showCloseWhenIdle && onClose ? (
        <PillButton icon={X} onClick={onClose} label="Close" />
      ) : null}
    </HeaderPill>
  )
}
