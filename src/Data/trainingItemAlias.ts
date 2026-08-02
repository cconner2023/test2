/**
 * trainingItemAlias -- resolves the ICTL/STP task-number collision at fold time.
 *
 * The 68W SL1 ICTL and the STP roster share 17 task numbers, and only 5 of those
 * pairs are the same task. The rest reuse a number for different scope: ICTL
 * `081-000-0125` is Treat Massive Hemorrhage, STP `081-000-0125` is Maintain a
 * Nasogastric Tube. So the STP-side row of every collision carries a `(b)` suffix
 * and nothing is deleted (USR 2026-07-29 -- the relationship is additive AND
 * substitutive; see .claude/Projects/_ideas/consolidation-decisions.md).
 *
 * WHY AN ALIAS EXISTS AT ALL. Training completions are event-sourced: state is
 * foldTrainingState() over append-only audit_log events, grouped on
 * (subject, payload.training_item_id). Every event recorded before the rename
 * carries the BARE number, so renaming the roster alone would fold a soldier's
 * historical STP credit onto the ICTL task of the same number -- silently, and
 * the log is immutable, so it could not be corrected afterwards.
 *
 * WHY IT WAS UNCONDITIONAL UNTIL 2026-07-31. Nothing had ever emitted an ICTL
 * completion: getEvaluableTaskData had no ICTL branch and ICTLContent had no
 * consumer outside IctlPanel / KnowledgeBaseDrawer, both browse-only. Every
 * bare-number event in the log is therefore an STP event by definition, with no
 * ICTL event to misclassify -- which is what made aliasing every pre-existing
 * event exact rather than merely convenient.
 *
 * WHY IT COULD NOT STAY UNCONDITIONAL. ICTL evaluation shipped 2026-07-31
 * (getEvaluableTaskData resolves ICTL packets ahead of the STP substrate, and
 * the supervisor's categories are the ICTL roster). From that instant the rule
 * inverts: a NEW bare-number event is an ICTL completion, and aliasing it would
 * divert ICTL credit to the STP row -- the same corruption in the opposite
 * direction. That is what ICTL_EVALUABLE_FROM guards, and it is why the boundary
 * is expressed as "when did ICTL become evaluable" rather than a deploy
 * timestamp nobody can pin down after the fact.
 */

/** Suffix marking the STP-side row of a shared task number. */
export const STP_VARIANT_SUFFIX = '(b)'

/**
 * Task numbers held by BOTH the 68W SL1 ICTL and the STP roster. The ICTL keeps
 * the bare number; the STP row takes the suffix.
 *
 * Same-task pairs (the STP row is the narrower legacy authoring of the same
 * skill): 0055 Triage, 0122 Surgical Cric, 0127 Open Abdominal Wound,
 * 68W-0167 Telemedicine, 68W-0168 Dental.
 *
 * Different-task pairs, where the number is all the two share: 0037 chest injury
 * vs thoracic injury, 0040/0044 broader ICTL framings, 0049 Perform TCCC vs
 * Combat Casualty Assessment, 0118 CBRN vs radiation only, 0125 massive
 * hemorrhage vs nasogastric tube, 68W-0005 conduct vs enforce field sanitation,
 * 68W-0125 dermatological complaint vs skin disorders, 68W-0239 GI complaint vs
 * abdominal disorders, 68W-0240 EENT vs common eye infections, 68W-0245
 * cardiorespiratory vs common respiratory disorders, 68W-0246 behavioral health
 * emergency vs behavioral emergency.
 */
export const ICTL_STP_COLLISIONS: ReadonlySet<string> = new Set([
  '081-000-0037',
  '081-000-0040',
  '081-000-0044',
  '081-000-0049',
  '081-000-0055',
  '081-000-0118',
  '081-000-0122',
  '081-000-0125',
  '081-000-0127',
  '081-68W-0005',
  '081-68W-0125',
  '081-68W-0167',
  '081-68W-0168',
  '081-68W-0239',
  '081-68W-0240',
  '081-68W-0245',
  '081-68W-0246',
])

/**
 * ISO instant from which a bare colliding number means the ICTL task rather than
 * the STP one -- i.e. when ICTL tasks first became evaluable and started emitting
 * completions of their own.
 *
 * `null` meant ICTL was still browse-only, so EVERY event for a colliding number
 * was an STP event and was aliased. Set here in the same change that made ICTL
 * evaluable, per the standing instruction above.
 *
 * ⚠️ CONFIRM THIS AGAINST THE ACTUAL DEPLOY. It is a boundary, so being wrong in
 * either direction misfiles credit for the 17 colliding numbers: too early and a
 * late STP completion from a client still running the old bundle lands on the
 * ICTL row; too late and a fresh ICTL completion lands on the STP row. The
 * exposure window is only as wide as the gap between this value and the build
 * actually reaching devices, so move it forward if the deploy slips.
 */
export const ICTL_EVALUABLE_FROM: string | null = '2026-07-31T00:00:00Z'

/**
 * Resolve a raw `training_item_id` to the item it actually refers to.
 *
 * Non-colliding ids (STP-only numbers, ICTL-only numbers, `algo:<id>:<dim>` keys)
 * pass through untouched. Apply this at the FOLD, beneath every reader, so no
 * caller has to remember the collision list.
 */
export function aliasTrainingItemId(itemId: string, occurredAt: string): string {
  if (!ICTL_STP_COLLISIONS.has(itemId)) return itemId
  if (ICTL_EVALUABLE_FROM === null) return itemId + STP_VARIANT_SUFFIX
  return occurredAt < ICTL_EVALUABLE_FROM ? itemId + STP_VARIANT_SUFFIX : itemId
}
