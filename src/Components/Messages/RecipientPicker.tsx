import { PreviewOverlay } from '../PreviewOverlay'
import { ContactListItem } from '../Settings/ContactListItem'
import { useMessageRoster } from '../../Hooks/useMessageRoster'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'

interface RecipientPickerProps {
  isOpen: boolean
  onClose: () => void
  /** Fires when a contact is tapped. Caller owns the action (open / forward). */
  onSelect: (medic: ClinicMedic) => void
  title?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Prepend a self row (self-notes). */
  includeSelf?: boolean
  selfLabel?: string
  /** Recipient ids to omit (e.g. current conversation peer). */
  excludeIds?: string[]
  /** When set, contacts with an existing conversation sort first. */
  conversations?: Record<string, DecryptedSignalMessage[]>
  /** Override the PreviewOverlay z-tier when stacked above a host sheet. */
  zIndex?: number
}

/**
 * THE shared "pick one recipient" primitive — a searchable cluster roster in a
 * PreviewOverlay. Used by message forward (and any new-message entry point).
 * Multi-select / cross-cluster sharing layers on top of the same roster via
 * useMessageRoster (see ShareToChatPicker); this component is the single-select
 * case. Roster + filter live in useMessageRoster so no surface hand-rolls them.
 */
export function RecipientPicker({
  isOpen,
  onClose,
  onSelect,
  title = 'Send to…',
  searchPlaceholder = 'Search contacts…',
  emptyText = 'No contacts found',
  includeSelf,
  selfLabel,
  excludeIds,
  conversations,
  zIndex,
}: RecipientPickerProps) {
  const { applyFilter } = useMessageRoster({ includeSelf, selfLabel, excludeIds, conversations })

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      title={title}
      searchPlaceholder={searchPlaceholder}
      previewMaxHeight="50dvh"
      {...(zIndex !== undefined ? { zIndex } : {})}
      preview={(filter: string) => {
        const filtered = applyFilter(filter)
        if (filtered.length === 0) {
          return <p className="text-[10pt] text-tertiary text-center py-6">{emptyText}</p>
        }
        return (
          <div className="py-1">
            {filtered.map(medic => (
              <ContactListItem key={medic.id} medic={medic} onClick={() => onSelect(medic)} />
            ))}
          </div>
        )
      }}
    />
  )
}
