/**
 * Individual Critical Task List (ICTL) — 68W Combat Medic Specialist, Skill Level 1.
 *
 * Approved / effective 08 Apr 2026 (JBSA Fort Sam Houston / MEDCoE). 32 critical tasks
 * across 5 subject areas. This is a SEPARATE artifact from the STP soldier's-manual roster
 * in TrainingTaskList.ts (`stp68wTraining`) — the STP list is the broader content + algorithm
 * substrate; the ICTL is the Army's approved critical-task subset the unit tracks proficiency
 * against. The two lists are intentionally decoupled and share only the task-number key, so a
 * completion recorded under a task number is visible to whichever list references it.
 *
 * Titles here are the ICTL titles as published (which differ from the older STP titles for
 * "crossing" tasks that kept their number but were renamed/rescoped). The doctrinal-typo
 * "Cricothyriodotomy" in the source PDF is corrected to "Cricothyroidotomy" here.
 *
 * 081-000-0125 and the sixteen other shared numbers: the ICTL reassigns this one to "Treat
 * Massive Hemorrhage" while the STP roster's entry is "Maintain a Nasogastric Tube". RESOLVED
 * 2026-07-29/31 — the STP-side row of every collision now carries a `(b)` suffix in both
 * TrainingTaskList and TrainingData, so a bare number belongs to the ICTL alone; historical
 * events are re-pointed at fold time by aliasTrainingItemId (see trainingItemAlias.ts). Evaluation
 * resolves through getEvaluableTaskData, where the ICTL packet wins over the legacy STP entry.
 */

import type { stp68wTrainingTypes } from './TrainingTaskList'

export const ICTL_MOS = '68W'
export const ICTL_SKILL_LEVEL = 'SL1'
export const ICTL_DUTY_POSITION = 'SQF'
export const ICTL_APPROVED_DATE = '2026-04-08'

/**
 * The approved 68W SL1 ICTL (08 Apr 2026), grouped by subject area. Shares the STP list's
 * shape (`stp68wTrainingTypes[]`) so existing task-list consumers can iterate it identically;
 * the single top-level entry's `skillLevel` names the list rather than a soldier's-manual tier.
 */
export const ictl68wSL1: stp68wTrainingTypes[] = [
  {
    skillLevel: '68W SL1 ICTL (08 Apr 2026)',
    subjectArea: [
      {
        name: 'Clinical Treatment',
        tasks: [
          { id: '081-68W-0125', title: 'Treat a Patient With Dermatological Complaint' },
          { id: '081-68W-0165', title: 'Treat a Patient with Gynecological Complaint' },
          { id: '081-68W-0167', title: 'Employ Telemedicine' },
          { id: '081-68W-0168', title: 'Treat Dental Emergencies' },
          { id: '081-68W-0239', title: 'Treat a Patient With Gastrointestinal Complaint' },
          { id: '081-68W-0240', title: 'Treat a Patient With Eye, Ear, Nose, Throat Complaint' },
          { id: '081-68W-0245', title: 'Treat a Patient With Cardiorespiratory Complaint' },
          { id: '081-68W-0246', title: 'Manage a Patient with a Behavioral Health Emergency' },
          { id: '081-68W-0248', title: 'Treat a Patient With Toxicological Emergency' },
          { id: '081-68W-0249', title: 'Treat a Patient With Musculoskeletal Complaint' },
          { id: '081-68W-0250', title: 'Treat a Patient With General Medical Complaint' },
          { id: '081-68W-0251', title: 'Treat Infectious Diseases' },
          { id: '081-68W-1059', title: 'Treat a Patient With Neuropsychatric Complaint' },
        ],
      },
      {
        name: 'General Medical Preparedness',
        tasks: [
          { id: '081-68W-0005', title: 'Conduct Unit Field Sanitation Measures' },
        ],
      },
      {
        name: 'Patient Evacuation',
        tasks: [
          { id: '081-68W-0283', title: 'Conduct Patient Transfer' },
        ],
      },
      {
        name: 'Prolonged Care',
        tasks: [
          { id: '081-000-1020', title: 'Perform Prolonged Casualty Care' },
        ],
      },
      {
        name: 'Trauma Treatment',
        tasks: [
          { id: '081-000-0003', title: 'Treat a Casualty With Environmental Injury' },
          { id: '081-000-0037', title: 'Treat a Patient With Chest Injury' },
          { id: '081-000-0040', title: 'Treat a Patient With Head Injury' },
          { id: '081-000-0044', title: 'Treat a Patient With Burn Injuries' },
          { id: '081-000-0049', title: 'Perform Tactical Combat Casualty Care' },
          { id: '081-000-0055', title: 'Perform Casualty Triage' },
          { id: '081-000-0108', title: 'Treat an Expectant Patient' },
          { id: '081-000-0118', title: 'Treat a Casualty With Chemical Biological Radiation Nuclear Exposure' },
          { id: '081-000-0120', title: 'Perform a Simple (Finger) Thoracostomy' },
          { id: '081-000-0122', title: 'Perform a Surgical Cricothyroidotomy' },
          { id: '081-000-0125', title: 'Treat Massive Hemorrhage' },
          { id: '081-000-0127', title: 'Treat an Open Abdominal Wound' },
          { id: '081-000-0231', title: 'Treat a Patient Suspected Of Shock' },
          { id: '081-000-0238', title: 'Place an Intraosseous Device' },
          { id: '081-000-1025', title: 'Administer Blood Products' },
          { id: '081-000-1653', title: 'Perform K9 Tactical Combat Casualty Care' },
        ],
      },
    ],
  },
]

/** Flat set of all task numbers on the ICTL — for O(1) "is this task critical?" checks. */
export const ictlTaskIds: ReadonlySet<string> = new Set(
  ictl68wSL1.flatMap(g => g.subjectArea.flatMap(a => a.tasks.map(t => t.id))),
)

/** True if `taskId` is on the approved 68W SL1 ICTL. */
export function isIctlTask(taskId: string): boolean {
  return ictlTaskIds.has(taskId)
}
