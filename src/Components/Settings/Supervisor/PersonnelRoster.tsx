import { useState, useMemo, useCallback, useEffect } from 'react'
import { Users, ClipboardCheck, Eye, Pencil, ChevronRight, Building2 } from 'lucide-react'
import { EmptyState } from '../../EmptyState'
import { SearchInput } from '../../SearchInput'
import { SwipeableRosterCard } from './SwipeableRosterCard'
import { CardContextMenu } from '../../CardContextMenu'
import { CardActionBar, type ActionBarAction } from '../../CardActionBar'
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
  selectedSoldierIds: Set<string>
  onSelectSoldiers: (ids: Set<string>) => void
  onEvaluate: (soldier: ClinicMedic) => void
  onView: (soldier: ClinicMedic) => void
  onModify: (soldier: ClinicMedic) => void
  showSearch?: boolean
  clinicName?: string | null
  teamMetrics?: TeamMetrics
  onViewInsights?: () => void
  onManageClinic?: () => void
}

export function PersonnelRoster({
  medics,
  certsForSoldier,
  overdueCount,
  selectedSoldierIds,
  onSelectSoldiers,
  onEvaluate,
  onView,
  onModify,
  showSearch = false,
  clinicName,
  teamMetrics,
  onViewInsights,
  onManageClinic,
}: PersonnelRosterProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ soldierId: string; x: number; y: number } | null>(null)

  // Clear search when search panel is hidden
  useEffect(() => { if (!showSearch) setSearchQuery('') }, [showSearch])

  const multiSelectMode = selectedSoldierIds.size > 0

  const filteredMedics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return medics
    return medics.filter(m => {
      const name = formatMedicName(m).toLowerCase()
      const cred = (m.credential ?? '').toLowerCase()
      return name.includes(q) || cred.includes(q)
    })
  }, [medics, searchQuery])

  const handleToggleMultiSelect = useCallback((soldierId: string) => {
    onSelectSoldiers((() => {
      const next = new Set(selectedSoldierIds)
      if (next.has(soldierId)) next.delete(soldierId)
      else next.add(soldierId)
      return next
    })())
  }, [selectedSoldierIds, onSelectSoldiers])

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

  // Bottom bar actions differ by selection count
  const singleSelected = selectedSoldierIds.size === 1
  const barActions: ActionBarAction[] = []
  if (singleSelected) {
    const soldier = getSoldierById([...selectedSoldierIds][0])
    if (soldier) {
      barActions.push(
        { key: 'view', label: 'View', icon: Eye, iconBg: 'bg-themegreen/15', iconColor: 'text-themegreen', onAction: () => { onSelectSoldiers(new Set()); onView(soldier) } },
        { key: 'evaluate', label: 'Evaluate', icon: ClipboardCheck, iconBg: 'bg-themeblue2/15', iconColor: 'text-themeblue2', onAction: () => { onSelectSoldiers(new Set()); onEvaluate(soldier) } },
      )
    }
  } else {
    barActions.push({
      key: 'evaluate',
      label: 'Evaluate',
      icon: ClipboardCheck,
      iconBg: 'bg-themeblue2/15',
      iconColor: 'text-themeblue2',
      onAction: () => {
        const ids = [...selectedSoldierIds]
        onSelectSoldiers(new Set())
        const first = getSoldierById(ids[0])
        if (first) onEvaluate(first)
      },
    })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 md:px-5 md:py-5">
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
              {onManageClinic && (
                <button
                  onClick={(e) => { e.stopPropagation(); onManageClinic() }}
                  className="p-1.5 rounded-lg hover:bg-tertiary/10 text-tertiary/40 hover:text-themeblue3 transition-colors active:scale-95 shrink-0"
                >
                  <Pencil size={14} />
                </button>
              )}
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

        {/* Search — toggled by header pill */}
        {showSearch && (
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search personnel..."
            className="mb-3"
            autoFocus
          />
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
                isSelected={selectedSoldierIds.has(soldier.id)}
                multiSelectMode={multiSelectMode}
                onOpen={() => { setOpenCardId(soldier.id) }}
                onClose={() => setOpenCardId(prev => prev === soldier.id ? null : prev)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ soldierId: soldier.id, x: e.clientX, y: e.clientY }) }}
                onToggleMultiSelect={() => handleToggleMultiSelect(soldier.id)}
                onTap={() => {
                  setOpenCardId(null)
                  // Single-tap selects (shows bottom bar)
                  if (!multiSelectMode) {
                    const isTogglingOff = selectedSoldierIds.has(soldier.id)
                    onSelectSoldiers(isTogglingOff ? new Set() : new Set([soldier.id]))
                  }
                }}
                onEvaluate={() => onEvaluate(soldier)}
                onView={() => onView(soldier)}
                onModify={() => onModify(soldier)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Multi-select action bar — pinned at bottom, outside scroll */}
      {multiSelectMode && (
        <div className="shrink-0">
          <CardActionBar
            selectedCount={selectedSoldierIds.size}
            onClear={() => onSelectSoldiers(new Set())}
            actions={barActions}
          />
        </div>
      )}

      {/* Right-click context menu */}
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
    </div>
  )
}
