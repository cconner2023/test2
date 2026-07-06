import { useAuthStore } from '../stores/useAuthStore'

/**
 * Staged feature-rollout gate — the primitive behind Beacon's release pipeline:
 *
 *     dev-gate  →  single-cluster pilot  →  release
 *
 * A feature advances by editing ONE string in FEATURE_STAGE:
 *   'dev'      → visible to dev-role users only
 *   'pilot'    → visible to dev-role users + members of the feature's pilot cluster(s)
 *   'released' → visible to everyone
 *
 * ENVIRONMENT BYPASS (per USR): the dev/sandbox backend (motkbwhbnlqhlaqboclj) is an
 * all-dev population, so EVERY feature is fully visible there regardless of stage —
 * developers always see the whole app locally. Gating only bites against the production
 * backend (flekwqtlnpvffamqroen), which carries real cluster users. The backend is read
 * from VITE_SUPABASE_URL, so it tracks the actual authenticated population, not the
 * build mode.
 *
 * Pilot is keyed by clinic_id, NOT clinic name — clinics get renamed (e.g. BAS→RAHC).
 */

type Stage = 'dev' | 'pilot' | 'released'

/** Current rollout stage per feature. Edit to advance a feature down the pipeline. */
export const FEATURE_STAGE = {
  // DA 2062 hand receipts + DA 3161 turn-in lifecycle + shortage annex — the property
  // accountability suite. Released in 2.7.0 after piloting on 1-14 FA 75TH FA III CORPS.
  propertyAccountability: 'released',
} satisfies Record<string, Stage>

export type GatedFeature = keyof typeof FEATURE_STAGE

/** Pilot cluster clinic_id(s) per feature on the PRODUCTION backend. Absent/empty ⇒ the
 *  'pilot' stage grants nothing beyond devs. */
export const PILOT_CLUSTERS: Partial<Record<GatedFeature, readonly string[]>> = {
  // 1-14 FA 75TH FA III CORPS (flekwqtlnpvffamqroen)
  propertyAccountability: ['ce06896f-0ff8-410e-b7a8-9ad44f97b20f'],
}

// The dev/sandbox backend project ref — an all-dev population, so nothing is ever gated
// when the app is pointed there (local `npm run dev`). Production points at a different
// ref, where the stage gates apply.
const SANDBOX_PROJECT_REF = 'motkbwhbnlqhlaqboclj'

function onDevBackend(): boolean {
  return String(import.meta.env.VITE_SUPABASE_URL ?? '').includes(SANDBOX_PROJECT_REF)
}

/** Non-hook resolver — for call sites that already hold auth state. */
export function canSeeFeature(
  feature: GatedFeature,
  opts: { isDevRole: boolean; clinicId: string | null },
): boolean {
  if (onDevBackend()) return true // sandbox = all devs → show everything
  const stage = FEATURE_STAGE[feature]
  if (stage === 'released') return true
  if (opts.isDevRole) return true // devs retain access through every pre-release stage
  if (stage === 'pilot') {
    return !!opts.clinicId && (PILOT_CLUSTERS[feature] ?? []).includes(opts.clinicId)
  }
  return false // 'dev' stage, non-dev user
}

/** Hook: subscribe to auth state and resolve whether to show a staged feature. */
export function useFeatureGate(feature: GatedFeature): boolean {
  const isDevRole = useAuthStore((s) => s.isDevRole)
  const clinicId = useAuthStore((s) => s.clinicId)
  return canSeeFeature(feature, { isDevRole, clinicId })
}
