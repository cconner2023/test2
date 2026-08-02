/**
 * ictlAdtmc -- which ADTMC algorithms stand as criteria for which ICTL task.
 *
 * WHY THIS EXISTS. Thirteen ICTL packets cite MEDCOM Pam 40-7-21 (ADTMC) as a
 * required reference, and for the clinic-complaint tasks the citation is not
 * background reading: "Treat a Patient With Dermatological Complaint" IS applying
 * the dermatological algorithms. So the algorithms are not a separate readiness
 * number sitting beside the ICTL -- they are steps of it. USR 2026-07-31:
 * "ADTMC completion counts for a step in the ICTL (example HEENT complete A-1)."
 *
 * ONE ALGORITHM = ONE STEP, deliberately, rather than one category = one step.
 * A soldier who has cleared four of the five ENT algorithms has made four fifths
 * of the progress, and a criterion that only flips at the category boundary would
 * report that as zero. Marking off is the same rule read at the end: every mapped
 * algorithm trained means every step is done, which is what completes the ICTL.
 *
 * WHY ONLY EIGHT ENTRIES. These are the ICTLs whose title names an ADTMC category
 * outright, so the mapping is a reading of the roster rather than a judgement
 * about scope. USR 2026-07-31 declined to extend it to the packets that cite
 * ADTMC without matching a category -- Dental, Toxicological, Infectious Disease,
 * General Medical, Behavioral Health, TCCC. Those keep pure measure-based
 * evaluation. GENITOURINARY, MISCELLANEOUS and MISCELLANEOUS RETURN are therefore
 * claimed by no ICTL; they remain testable in their own right, they just do not
 * roll up into one. Do not "complete" the map by inventing the missing halves --
 * the gaps are the decision.
 *
 * Category keys are the catData category `text` verbatim. A typo would silently
 * resolve to zero algorithms and quietly drop the criteria, so the resolver
 * reports unmatched names instead of shrugging -- see assertIctlAdtmcMap.
 */

import { listAllAlgorithms } from './algorithmStp'
import { createLogger } from './Logger'

const logger = createLogger('ictlAdtmc')

/** ICTL task number -> the ADTMC categories whose algorithms are its steps. */
export const ICTL_ADTMC_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  // EENT is the one packet spanning two categories: the ADTMC splits eye from
  // ear/nose/throat, the ICTL does not.
  '081-68W-0240': ['EAR, NOSE, THROAT', 'EYE'],
  '081-68W-0249': ['MUSCULOSKELETAL'],
  '081-68W-0239': ['GASTROINTESTINAL'],
  '081-68W-0245': ['CARDIORESPIRATORY'],
  '081-68W-1059': ['NEUROPSYCHIATRIC'],
  '081-68W-0165': ['GYNECOLOGICAL'],
  '081-68W-0125': ['DERMATOLOGICAL'],
  // The one mapped task outside Clinical Treatment: it sits in Trauma Treatment
  // but cites ADTMC and matches the ENVIRONMENTAL category exactly.
  '081-000-0003': ['ENVIRONMENTAL'],
}

/** One ADTMC step of an ICTL. */
export interface IctlAdtmcAlgorithm {
  id: string
  name: string
  category: string
  /** The STP tasks doctrinally under this algorithm. A prerequisite is the
   *  algorithm AND these together, so a surface that names one without the other
   *  is naming half of what has to be cleared. Empty for an algorithm with no
   *  mapped STP — a real content gap, not an error. */
  taskNumbers: string[]
}

/** True when this ICTL's completion has ADTMC steps at all. */
export function hasAdtmcCriteria(taskNumber: string): boolean {
  return taskNumber in ICTL_ADTMC_CATEGORIES
}

/**
 * The algorithms standing as this ICTL's steps, in catData render order. Returns
 * [] for an unmapped task, which is how every caller treats "this ICTL is graded
 * on its measures alone".
 */
export function ictlAdtmcAlgorithms(taskNumber: string): IctlAdtmcAlgorithm[] {
  const categories = ICTL_ADTMC_CATEGORIES[taskNumber]
  if (!categories) return []
  const wanted = new Set(categories)
  return listAllAlgorithms()
    .filter((a) => wanted.has(a.category))
    .map((a) => ({ id: a.id, name: a.name, category: a.category, taskNumbers: a.taskNumbers }))
}

/** The ADTMC categories named here, for display next to the criteria list. */
export function ictlAdtmcCategories(taskNumber: string): string[] {
  return [...(ICTL_ADTMC_CATEGORIES[taskNumber] ?? [])]
}

/**
 * Log any mapped category name that matches no catData category. Called once at
 * module load: a renamed or mistyped category is not a crash, it is a silent loss
 * of every criterion under it, which is the failure mode worth being loud about.
 */
function assertIctlAdtmcMap(): void {
  const known = new Set(listAllAlgorithms().map((a) => a.category))
  const missing = Object.entries(ICTL_ADTMC_CATEGORIES)
    .flatMap(([task, cats]) => cats.filter((c) => !known.has(c)).map((c) => `${task} -> "${c}"`))
  if (missing.length > 0) {
    logger.error('ICTL_ADTMC_CATEGORIES names categories not in catData:', missing.join(', '))
  }
}

assertIctlAdtmcMap()

