import { Users } from 'lucide-react'
import { UserAvatar } from './Settings/UserAvatar'
import { getDisplayName } from '../Utilities/nameUtils'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { GroupInfo } from '../lib/signal/groupTypes'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { UnavailableReason } from '../Hooks/usePeerAvailability'

const UNAVAILABLE_LABELS: Record<UnavailableReason, string> = {
  no_device: 'Not yet registered',
  no_keys: 'Setting up encryption',
}

interface ConversationPreviewProps {
  conversationKey: string
  type: 'contact' | 'group'
  medic?: ClinicMedic
  group?: GroupInfo
  conversations: Record<string, DecryptedSignalMessage[]>
  userId: string | null
  unavailableReason?: UnavailableReason
}

export function ConversationPreview({
  conversationKey,
  type,
  medic,
  group,
  conversations,
  userId,
  unavailableReason,
}: ConversationPreviewProps) {
  const msgs = conversations[conversationKey]
    ?.filter(m => m.messageType !== 'request-accepted' && !m.threadId)
    .slice(-5) ?? []

  if (type === 'contact' && medic) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-12 h-12" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{getDisplayName(medic)}</p>
            {unavailableReason ? (
              <p className="text-[9pt] text-thememuted">{UNAVAILABLE_LABELS[unavailableReason]}</p>
            ) : (
              <>
                {medic.credential && <p className="text-[9pt] text-tertiary">{medic.credential}</p>}
                {medic.clinicName && <p className="text-[9pt] text-tertiary">{medic.clinicName}</p>}
              </>
            )}
          </div>
        </div>
        <MessageSnippets msgs={msgs} userId={userId} />
      </div>
    )
  }

  if (type === 'group' && group) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
            <Users size={22} className="text-themeblue2" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{group.name}</p>
            <p className="text-[9pt] text-tertiary">{group.memberCount} members</p>
          </div>
        </div>
        <MessageSnippets msgs={msgs} userId={userId} />
      </div>
    )
  }

  return null
}

function MessageSnippets({ msgs, userId }: { msgs: DecryptedSignalMessage[]; userId: string | null }) {
  if (!msgs.length) return null

  return (
    <div className="space-y-1.5">
      <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-0.5">Recent</p>
      {msgs.map(msg => {
        const isOwn = msg.senderId === userId
        const text = msg.plaintext
          || (msg.messageType === 'image' ? 'Image' : msg.messageType === 'voice' ? 'Voice message' : 'Message')
        return (
          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[10pt] leading-relaxed ${
              isOwn ? 'bg-themeblue2/10 text-primary' : 'bg-primary/5 text-primary'
            }`}>
              <p className="line-clamp-2">{text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
