/**
 * BETA FEATURE REGISTRY
 *
 * Dev role in Beacon doubles as the beta-tester pool. Listing a key here means
 * "feature in beta — dev sees it, others don't yet." Flip the value to `false`
 * when promoting to general availability; delete the key entirely once the
 * feature is fully stable and you no longer need to track its rollout.
 *
 * This registry is the single source of truth for the "dev is beta-testing this"
 * concept. It is SEPARATE from role permissions (medic / supervisor / provider /
 * dev). Permission gates ("only dev can perform admin ops", "supervisor manages
 * the cluster") still use the role flags from useAuthStore directly. Beta gates
 * use one of the helpers below.
 *
 * Two helpers for two patterns:
 *
 *   1. Standalone — feature has no underlying role gate. During beta only dev
 *      sees it; after promotion everyone authenticated sees it. Use
 *      `useBetaFlag(key)` (or `isBetaFlagEnabled(key)` outside React) as the
 *      sole visibility check.
 *        e.g. WhisperNet Settings panel
 *
 *   2. Additive — feature already has a role permission gate. During beta dev
 *      additionally bypasses that gate for testing. After promotion the role
 *      gate stands alone (dev no longer gets a free pass). Use
 *      `useBetaBypass(key)` and combine with `||` against the role gate.
 *        e.g. `isSupervisorRole || useBetaBypass('outsideCall')`
 *
 * The semantic distinction matters at promotion time: a standalone feature
 * opens to all; an additive feature loses only the dev bypass. Pick the helper
 * that matches the feature's eventual GA audience.
 */

import { useAuthStore } from '../stores/useAuthStore'

export const BETA_FEATURES = {
  /** WhisperNet — LoRa mesh offline messaging Settings panel. Subsystem runs
   *  regardless; this gate only controls the user-facing config panel. */
  whisperNet: true,
  /** Outside on-call ("Allow calls") channel — intake + outside chat are GA
   *  (supervisor-permissioned, no bypass). The live-call channel stays in beta:
   *  dev sees the "Allow calls" toggle (and gets the supervisor card even without
   *  the supervisor role) so they can finish testing. Flip to false to promote
   *  calls to supervisors. */
  outsideCall: true,
  /** Algorithm → note routing — tagged algorithm list items (questionOptions.noteTag)
   *  auto-populate the custom note's HPI/PE sections from the YES/NO answers.
   *  Dev-only while tagging is rolled out per algorithm; flip to false to open to all. */
  algorithmNoteRouting: true,
  /** Personnel — opt-in self-location on the map overlay. Dev-only while it's
   *  being validated in prod; gates the island's share actions, the Personnel
   *  tree entry, and teammates' markers. Flip to false to open to all. */
  teamPresence: true,
  /** Outbound outside-contact — a clinic member emails a secure 1:1 invite to an
   *  outside recipient (reverse of the inbound QR/passphrase channels). Fully
   *  dev-gated end-to-end (create_outside_entity / set_outbound_enabled assert
   *  is_dev()); this flag hides the supervisor toggle + compose surface for
   *  non-dev until testing completes. Flip to false to promote to supervisors. */
  outboundContact: true,
} as const

export type BetaFeature = keyof typeof BETA_FEATURES

/**
 * Standalone gate. Returns `true` when the feature is visible to the current
 * user: only dev role while in beta, everyone once promoted.
 */
export function useBetaFlag(feature: BetaFeature): boolean {
  const isDevRole = useAuthStore((s) => s.isDevRole)
  return BETA_FEATURES[feature] ? isDevRole : true
}

/**
 * Additive bypass for features with an existing role permission gate. Returns
 * `true` only while the feature is in beta AND the user is dev. Combine with
 * `||` against the underlying role gate; once promoted (flag flipped to
 * `false`) the helper returns `false` for everyone and the role gate stands
 * alone.
 *
 *   const canSee = isSupervisorRole || useBetaBypass('outsideCall')
 */
export function useBetaBypass(feature: BetaFeature): boolean {
  const isDevRole = useAuthStore((s) => s.isDevRole)
  return BETA_FEATURES[feature] && isDevRole
}

/**
 * Imperative variant of {@link useBetaFlag} — for stores, services, and event
 * handlers outside React render.
 */
export function isBetaFlagEnabled(feature: BetaFeature): boolean {
  return BETA_FEATURES[feature]
    ? useAuthStore.getState().isDevRole
    : true
}

/**
 * Imperative variant of {@link useBetaBypass} — for stores, services, and
 * event handlers outside React render.
 */
export function isBetaBypassEnabled(feature: BetaFeature): boolean {
  return BETA_FEATURES[feature] && useAuthStore.getState().isDevRole
}
