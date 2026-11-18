import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('NotifyDispatcher')

/** Notification copy is server-built (send-push-notification); title/body here are
 *  ignored by the server and kept only for older call sites. */
export function fireNotification(payload: { user_id?: string; user_ids?: string[]; title?: string; body?: string; type?: string; request_id?: string; author_id?: string }): void {
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
