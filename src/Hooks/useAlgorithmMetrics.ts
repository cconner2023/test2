import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { emitAudit } from '../lib/auditService'

/**
 * Algorithm encounter logging — DISGUISED AS TRAINING for plausible deniability.
 *
 * An "encounter" here is real patient treatment. We do NOT want that fact legible
 * to anyone with raw DB/wire access, so `logNow` records it as an ordinary
 * training READ of the algorithm: an audit_log `read.recorded` (domain=training,
 * subject=the medic) whose only payload is `training_item_id = <algorithm id>`.
 *
 * The training_item_id lives in the ENCRYPTED payload (Tier-1 clinic key), exactly
 * like a genuine training read — so in the cleartext spine this event is
 * indistinguishable from any other training completion. An adversary without the
 * clinic key sees "a training read at time T," nothing more. The clinic-key holder
 * (the medic / their supervisor) decrypts and it folds as a real 'read' completion
 * for the algorithm, so it also counts as training. Deliberately carries NO
 * "encounter" marker — that anomaly would break the blend and defeat the point.
 */
export function useAlgorithmMetrics() {
  const { user, clinicId } = useAuth()

  const logNow = useCallback(async (algorithmId: string) => {
    if (!user?.id || !clinicId) return

    await emitAudit(
      {
        clinicId,
        actorId: user.id,
        domain: 'training',
        eventType: 'read.recorded',
        subjectType: 'user',
        subjectId: user.id,
        // Encrypted tail — same shape as a genuine training read (see the
        // deniability note above). No algorithm name, no encounter flag.
        payload: { training_item_id: algorithmId },
      },
      user.id,
    )
  }, [user, clinicId])

  return { logNow }
}
