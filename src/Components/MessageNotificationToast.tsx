import { TopBanner } from './primitives/TopBanner'
import type { MessageNotification } from '../Hooks/useMessageNotifications'

interface Props {
  notification: MessageNotification | null
  onDismiss: () => void
  onTap: (notification: MessageNotification) => void
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

export function MessageNotificationToast({ notification, onDismiss, onTap }: Props) {
  return (
    <TopBanner
      item={notification}
      tone="message"
      zIndex={80}
      onDismiss={onDismiss}
      onTap={onTap}
      title={(n) => (n.isGroup && n.groupName ? n.groupName : n.senderName)}
      body={(n) => clip(n.isGroup ? `${n.senderName}: ${n.preview}` : n.preview, 60)}
    />
  )
}
