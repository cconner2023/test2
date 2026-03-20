import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('NotifyDispatcher')

export function fireNotification(payload: { user_id?: string; title?: string; body?: string; url?: string; type?: string; name?: string | null; email?: string | null; clinic_id?: string | null; author_id?: string }): void {
  supabase.functions.invoke('send-push-notification', {
    body: payload,
  }).then((response) => {
    if (response.error) {
      logger.warn('Push notification invoke error:', response.error)
    } else {
      logger.info('Push notification response:', response.data)
    }
  }).catch((err) => {
    logger.warn('Push notification delivery failed:', err)
  })
}
