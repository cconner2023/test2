import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { SubjectCard } from '../Settings/SubjectCard'

/**
 * Card at the top of a conversation's history: who this is. Rendered by
 * ChatDetailView above the first loaded message, so it scrolls with the thread
 * instead of pinning. Request Accept/Decline is not here; it stays pinned in the
 * composer slot.
 *
 * It is the settings profile card (SubjectCard) without the bars, so a contact
 * reads the same way your own profile does.
 *
 * The caption carries roster context only (credential, unit, member count).
 * Nothing here may be identity-linked clinical detail; see the no-PHI invariant.
 */
export function ConversationIntroCard({ avatar, title, subtitle, onInfo }: {
  /** Sized w-14 h-14 by the caller, the size SubjectCard's cover overlap is cut for. */
  avatar: ReactNode
  title: string
  subtitle?: string
  /** Opens conversation info from the cover's corner button. Omitted -> no button. */
  onInfo?: () => void
}) {
  return (
    <div className="max-w-xs mx-auto pt-2 pb-6">
      <SubjectCard
        icon={avatar}
        title={title}
        subtitle={subtitle || undefined}
        onActivate={onInfo ? () => onInfo() : undefined}
        actionIcon={ChevronRight}
        actionLabel="Conversation info"
      />
    </div>
  )
}
