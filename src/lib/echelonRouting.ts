/**
 * Echelon readiness-summary routing — the parent-side consume half of the
 * child→parent vault fold. Applies a decrypted `readiness_summary` message to
 * the parent-side IDB cache (echelonSummaries) and invalidates the 'echelon'
 * domain so the Subordinate Units cards refetch.
 *
 * App-level (not signal/*): the clinic-vault drain calls routeReadinessSummary
 * after it decrypts, exactly as it calls routeCalendarEvent / routePropertyEvent.
 *
 * Latest-wins by `computed_at`: a batch (or a fresh-device snapshot backfill
 * followed by a live tail) can present summaries for one source clinic out of
 * order; we only overwrite the cache when the incoming compute is strictly
 * newer, so a stale replay can't clobber a fresher value.
 */

import type { MessageContent, ReadinessSummaryContent } from './signal/messageContent'
import { getEchelonSummaries, putEchelonSummary } from './offlineDb'
import { invalidate } from '../stores/useInvalidationStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('echelonRouting')

/** Returns true if the content is a child readiness-summary sync message. */
export function isReadinessSummary(
  content: MessageContent | undefined | null,
): content is ReadinessSummaryContent {
  return content?.type === 'readiness_summary'
}

/**
 * Apply a readiness summary to the parent-side cache (latest-wins by
 * computed_at) and bump the echelon invalidation domain on a real change.
 * Idempotent and safe to call from any drain/backfill path.
 */
export async function routeReadinessSummary(content: ReadinessSummaryContent): Promise<void> {
  const { data } = content
  if (!data?.source_clinic_id) return
  try {
    const [existing] = await getEchelonSummaries([data.source_clinic_id])
    if (existing && existing.computed_at >= data.computed_at) return
    await putEchelonSummary(data)
    invalidate('echelon')
  } catch (e) {
    logger.warn('routeReadinessSummary failed:', e instanceof Error ? e.message : e)
  }
}
