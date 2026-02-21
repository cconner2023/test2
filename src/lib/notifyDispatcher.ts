import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('NotifyDispatcher')

export function fireNotification(payload: { user_id?: string; title?: string; body?: string; url?: string; type?: string; name?: string | null; email?: string | null; clinic_id?: string | null; author_id?: string | null }): void {
  supabase.functions.invoke('send-push-notification', {
    body: payload,
  }).catch((err) => {
    logger.warn('Push notification delivery failed:', err)
  })
}
