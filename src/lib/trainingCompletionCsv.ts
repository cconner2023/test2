/**
 * trainingCompletionCsv -- Soldier/Task/Date roster export for graded training.
 *
 * Three columns and nothing else, because the consumer is a unit training
 * tracker that already knows its own task list; anything richer gets pasted into
 * a column nobody reads.
 *
 * Scope is GO test completions only. A NO_GO row in a sheet titled "completions"
 * reads as a pass to whoever opens it downstream, and the sheet carries no result
 * column to disambiguate -- so failures are excluded rather than mislabelled.
 *
 * The date is when the grading event occurred. Because state is the fold over
 * append-only events (latest-wins per user + task), a re-graded task carries only
 * its MOST RECENT date -- an earlier pass inside the requested window is not
 * recoverable from the fold, only from the raw event stream.
 */

import { getEvaluableTaskData } from '../Utilities/algorithmCompetency'
import { stp68wTraining } from '../Data/TrainingTaskList'
import type { TrainingCompletionUI } from './trainingService'

export interface TrainingCompletionExportRow {
  soldier: string
  task: string
  /** ISO date (YYYY-MM-DD) of the grading. */
  date: string
}

export interface TrainingCompletionExportOptions {
  /** Resolve a userId to the display name written in the Soldier column. */
  resolveName: (userId: string) => string
  /** Inclusive ISO date bounds (YYYY-MM-DD) on the grading date. */
  startDate: string
  endDate: string
  /** When set, keep only these training item ids (subject-area scoping). */
  taskIds?: ReadonlySet<string>
}

/**
 * Roster titles keyed by task id. Preferred over getEvaluableTaskData because the
 * roster carries the `(b)` collision variants (see Data/trainingItemAlias) that
 * TrainingData does not always author.
 */
const rosterTitles: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>()
  for (const level of stp68wTraining) {
    for (const area of level.subjectArea) {
      for (const task of area.tasks) {
        if (!map.has(task.id)) map.set(task.id, task.title)
      }
    }
  }
  return map
})()

/** Human title for a training item id, covering STP tasks and `algo:<id>:<dim>` keys. */
export function resolveTrainingItemTitle(trainingItemId: string): string {
  return rosterTitles.get(trainingItemId)
    ?? getEvaluableTaskData(trainingItemId)?.title
    ?? trainingItemId
}

/** The date a completion is filed under, or null if it carries none. */
function completionDate(c: TrainingCompletionUI): string | null {
  const iso = c.completedAt ?? c.updatedAt
  return iso ? iso.slice(0, 10) : null
}

export function buildTrainingCompletionExportRows(
  completions: TrainingCompletionUI[],
  options: TrainingCompletionExportOptions,
): TrainingCompletionExportRow[] {
  const { resolveName, startDate, endDate, taskIds } = options

  const rows: TrainingCompletionExportRow[] = []
  for (const c of completions) {
    if (c.completionType !== 'test' || c.result !== 'GO') continue
    if (taskIds && !taskIds.has(c.trainingItemId)) continue
    const date = completionDate(c)
    if (!date || date < startDate || date > endDate) continue
    rows.push({
      soldier: resolveName(c.userId),
      task: resolveTrainingItemTitle(c.trainingItemId),
      date,
    })
  }

  return rows.sort((a, b) =>
    a.soldier.localeCompare(b.soldier)
    || a.date.localeCompare(b.date)
    || a.task.localeCompare(b.task),
  )
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function generateTrainingCompletionCsv(rows: TrainingCompletionExportRow[]): string {
  return [
    ['Soldier', 'Task', 'Date'],
    ...rows.map(r => [r.soldier, r.task, r.date]),
  ]
    .map(cols => cols.map(csvCell).join(','))
    .join('\r\n')
}

/** `training-completions-<stem>-20260701-20260729.csv`, filesystem-safe. */
export function trainingCompletionCsvFilename(stem: string, startDate: string, endDate: string): string {
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
  const compact = (d: string) => d.replace(/-/g, '')
  return `training-completions-${slug}-${compact(startDate)}-${compact(endDate)}.csv`
}

/**
 * Share or download the roster as a .csv. Mirrors shareTroopsToTaskCsv: Web Share
 * where the platform supports file shares (iOS Safari), anchor download otherwise.
 */
export async function shareTrainingCompletionCsv(
  rows: TrainingCompletionExportRow[],
  filename: string,
): Promise<void> {
  const csv = generateTrainingCompletionCsv(rows)
  // BOM so Excel reads UTF-8 names correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })

  if (
    typeof navigator !== 'undefined'
    && navigator.share
    && navigator.canShare?.({ files: [new File([blob], filename, { type: blob.type })] })
  ) {
    const file = new File([blob], filename, { type: blob.type })
    await navigator.share({ files: [file], title: 'Training completions' })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
