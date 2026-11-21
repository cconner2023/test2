import { TopBanner } from './primitives/TopBanner'
import type { ForegroundPush } from '../Hooks/usePushNotifications'

interface Props {
  notification: ForegroundPush | null
  onDismiss: () => void
}

export function PushNotificationToast({ notification, onDismiss }: Props) {
  return (
    <TopBanner
      item={notification}
      tone="push"
      zIndex={79}
      onDismiss={onDismiss}
      title={(n) => n.title}
      body={(n) => (n.body.length > 80 ? n.body.slice(0, 80) + '…' : n.body)}
    />
  )
}
