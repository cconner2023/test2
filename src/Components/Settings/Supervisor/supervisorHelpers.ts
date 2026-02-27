import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import { stp68wTraining } from '../../../Data/TrainingTaskList'
import { categoryOrder } from '../../../Data/TrainingConstants'

// ─── Name Formatting ─────────────────────────────────────────────────────────

export function formatMedicName(medic: ClinicMedic): string {
  const parts: string[] = []
  if (medic.rank) parts.push(medic.rank)
  if (medic.lastName) {
    let name = medic.lastName
    if (medic.firstName) name += ', ' + medic.firstName.charAt(0) + '.'
    if (medic.middleInitial) name += medic.middleInitial + '.'
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

// ─── Certification Status ────────────────────────────────────────────────────

export type ExpirationStatus = 'valid' | 'expiring' | 'expired' | 'none'

export function getExpirationStatus(expDate: string | null): ExpirationStatus {
  if (!expDate) return 'none'
  const now = new Date()
  const exp = new Date(expDate)
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'expired'
  if (diffDays <= 90) return 'expiring'
  return 'valid'
}

export const certBadgeColors = {
  valid:    'bg-themegreen/10 text-themegreen border-themegreen/30',
  expiring: 'bg-themeyellow/10 text-themeyellow border-themeyellow/30',
  expired:  'bg-themeredred/10 text-themeredred border-themeredred/30',
  none:     'bg-tertiary/5 text-tertiary/50 border-tertiary/20',
} as const

// ─── Testable Tasks ──────────────────────────────────────────────────────────

export interface FlatTask {
  taskId: string
  title: string
  levelIdx: number
  levelName: string
  areaName: string
}

export function buildTestableTasksByCategory(): Map<string, FlatTask[]> {
  const seen = new Map<string, Set<string>>()
  const grouped = new Map<string, FlatTask[]>()

  for (const cat of categoryOrder) {
    grouped.set(cat, [])
    seen.set(cat, new Set())
  }

  stp68wTraining.forEach((level, levelIdx) => {
    level.subjectArea.forEach((area) => {
      if (!grouped.has(area.name)) {
        grouped.set(area.name, [])
        seen.set(area.name, new Set())
      }
      const seenSet = seen.get(area.name)!
      area.tasks.forEach((task) => {
        if (seenSet.has(task.id)) return
        seenSet.add(task.id)
        grouped.get(area.name)!.push({
          taskId: task.id,
          title: task.title,
          levelIdx,
          levelName: level.skillLevel,
          areaName: area.name,
        })
      })
    })
  })

  for (const tasks of grouped.values()) {
    tasks.sort((a, b) => a.levelIdx - b.levelIdx || a.title.localeCompare(b.title))
  }

  return grouped
}
