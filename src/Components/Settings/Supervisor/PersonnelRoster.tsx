import { useState, useMemo, useCallback } from 'react'
import { Users, ClipboardCheck, Eye, Pencil, ChevronRight, Building2 } from 'lucide-react'
import { EmptyState } from '../../EmptyState'
import { SwipeableRosterCard } from './SwipeableRosterCard'
import { CardContextMenu } from '../../CardContextMenu'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'
import type { TeamMetrics } from './supervisorHelpers'

function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-themegreen'
  if (pct >= 50) return 'bg-themeyellow'
  return 'bg-themeredred'
}

function readinessTextColor(pct: number): string {
  if (pct >= 80) return 'text-themegreen'
  if (pct >= 50) return 'text-themeyellow'
  return 'text-themeredred'
}

interface PersonnelRosterProps {
  medics: ClinicMedic[]
  certsForSoldier: (userId: string) => Certification[]
  overdueCount: (userId: string) => number
  onEvaluate: (soldier: ClinicMedic) => void
  onView: (soldier: ClinicMedic) => void
  onModify: (soldier: ClinicMedic) => void
  searchQuery?: string
  clinicName?: string | null
  teamMetrics?: TeamMetrics
  onViewInsights?: () => void
}

export function PersonnelRoster({
  medics,
  certsForSoldier,
  overdueCount,
  onEvaluate,
  onView,
  onModify,
  searchQuery = '',
  clinicName,
  teamMetrics,
  onViewInsights,
}: PersonnelRosterProps) {
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ soldierId: string; x: number; y: number } | null>(null)

  const filteredMedics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return medics
    return medics.filter(m => {
      const name = formatMedicName(m).toLowerCase()
      const cred = (m.credential ?? '').toLowerCase()
      return name.includes(q) || cred.includes(q)
    })
  }, [medics, searchQuery])

  const getSoldierById = useCallback((id: string) => {
    return medics.find(m => m.id === id)
  }, [medics])

  if (medics.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} />}
        title="No medics found in your clinic"
      />
    )
  }

  return (
    <>
      <div className="px-4 py-3 md:px-5 md:py-5">
        {/* Clinic card — navigates to Team Insights */}
        {onViewInsights && teamMetrics && (
          <button
            onClick={onViewInsights}
            className="w-full rounded-xl bg-themewhite2 px-4 py-3 mb-3 text-left active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <Building2 size={16} className="text-tertiary/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary truncate">{clinicName ?? 'My Clinic'}</p>
                <p className="text-[9pt] text-tertiary/50">{medics.length} personnel</p>
              </div>
              <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
            </div>
            <div className="flex flex-col gap-1.5 mt-2 ml-11">
              <div className="flex items-center gap-2">
                <span className="text-[9pt] text-tertiary/50 w-18 shrink-0">Readiness</span>
                <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                  <div className={`h-full rounded-full ${readinessColor(teamMetrics.teamReadinessPercent)}`} style={{ width: `${teamMetrics.teamReadinessPercent}%` }} />
                </div>
                <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(teamMetrics.teamReadinessPercent)}`}>{teamMetrics.teamReadinessPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9pt] text-tertiary/50 w-18 shrink-0">Compliance</span>
                <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                  <div className={`h-full rounded-full ${readinessColor(teamMetrics.certCompliancePercent)}`} style={{ width: `${teamMetrics.certCompliancePercent}%` }} />
                </div>
                <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(teamMetrics.certCompliancePercent)}`}>{teamMetrics.certCompliancePercent}%</span>
              </div>
            </div>
          </button>
        )}

        {searchQuery.trim() && (
          <p className="text-[10px] text-tertiary/50 mb-2">
            {filteredMedics.length} result{filteredMedics.length !== 1 ? 's' : ''}
          </p>
        )}

        {filteredMedics.length === 0 && searchQuery.trim() ? (
          <EmptyState title="No personnel match your search" />
        ) : (
          <div className="space-y-2">
            {filteredMedics.map((soldier) => (
              <SwipeableRosterCard
                key={soldier.id}
                soldier={soldier}
                certs={certsForSoldier(soldier.id)}
                overdueCount={overdueCount(soldier.id)}
                isOpen={openCardId === soldier.id}
                onOpen={() => { setOpenCardId(soldier.id) }}
                onClose={() => setOpenCardId(prev => prev === soldier.id ? null : prev)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ soldierId: soldier.id, x: e.clientX, y: e.clientY }) }}
                onLongPress={(x, y) => { setContextMenu({ soldierId: soldier.id, x, y }) }}
                onTap={() => {
                  setOpenCardId(null)
                  onView(soldier)
                }}
                onEvaluate={() => onEvaluate(soldier)}
                onView={() => onView(soldier)}
                onModify={() => onModify(soldier)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right-click / long-press context menu */}
      {contextMenu && (() => {
        const soldier = getSoldierById(contextMenu.soldierId)
        if (!soldier) return null
        return (
          <CardContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              {
                key: 'view',
                label: 'View',
                icon: Eye,
                onAction: () => onView(soldier),
              },
              {
                key: 'evaluate',
                label: 'Evaluate',
                icon: ClipboardCheck,
                onAction: () => onEvaluate(soldier),
              },
              {
                key: 'modify',
                label: 'Modify',
                icon: Pencil,
                onAction: () => onModify(soldier),
              },
            ]}
          />
        )
      })()}
    </>
  )
}
