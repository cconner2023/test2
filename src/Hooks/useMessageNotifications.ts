/**
 * useMessageNotifications — Single-slot notification state for incoming messages.
 *
 * New messages replace the previous notification (like iOS).
 * Plays receive sound on notify. Auto-dismisses after NOTIFICATION_TOAST_DURATION.
 */

import { useState, useCallback, useRef } from 'react'
import { playReceiveSound } from '../lib/soundService'
import { UI_TIMING } from '../Utilities/constants'

export interface MessageNotification {
  peerId: string
  groupId?: string
  senderName: string
  preview: string
  isGroup: boolean
  groupName?: string
}

export function useMessageNotifications() {
  const [notification, setNotification] = useState<MessageNotification | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    setNotification(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const notify = useCallback((n: MessageNotification) => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current)

    setNotification(n)
    playReceiveSound()

    timerRef.current = setTimeout(() => {
      setNotification(null)
      timerRef.current = null
    }, UI_TIMING.NOTIFICATION_TOAST_DURATION)
  }, [])

  return { notification, notify, dismiss }
}
