import { useMemo } from 'react'
import { Users, Search, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { getInitials } from '../../Utilities/nameUtils'
import { EmptyState } from '../EmptyState'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

function formatName(m: ClinicMedic): string {
  const parts: string[] = []
  if (m.rank) parts.push(m.rank)
  if (m.lastName) {
    let name = m.lastName
    if (m.firstName) name += ', ' + m.firstName.charAt(0) + '.'
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

interface RosterPaneProps {
  onAssignToEvent?: (userId: string) => void
  assignableEventId?: string | null
  compact?: boolean
}

export function RosterPane({ onAssignToEvent, assignableEventId, compact }: RosterPaneProps) {
  const { medics, loading } = useClinicMedics()
  const { ownClinicMedics } = useClinicGroupedMedics(medics)
  const { rosterSearchQuery, setRosterSearchQuery, events } = useCalendarStore(useShallow(s => ({
    rosterSearchQuery: s.rosterSearchQuery,
    setRosterSearchQuery: s.setRosterSearchQuery,
    events: s.events,
  })))

  const assignedSet = useMemo(() => {
    if (!assignableEventId) return new Set<string>()
    const event = events.find(e => e.id === assignableEventId)
    return new Set(event?.assigned_to ?? [])
  }, [assignableEventId, events])

  const filtered = useMemo(() => {
    if (!rosterSearchQuery.trim()) return ownClinicMedics
    const q = rosterSearchQuery.toLowerCase()
    return ownClinicMedics.filter(m =>
      formatName(m).toLowerCase().includes(q) ||
      (m.credential?.toLowerCase().includes(q))
    )
  }, [ownClinicMedics, rosterSearchQuery])

  return (
    <div className={`flex flex-col h-full ${compact ? '' : 'border-r border-primary/10'}`}>
      {/* Header */}
      <div className={`px-3 border-b border-primary/10 ${compact ? 'py-2' : 'py-2'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Users size={compact ? 14 : 16} className="text-themeblue3" />
          <h3 className={`font-semibold text-primary ${compact ? 'text-xs' : 'text-sm'}`}>Roster</h3>
          <span className="text-xs text-tertiary/60">{ownClinicMedics.length}</span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tertiary/40" />
          <input
            type="text"
            value={rosterSearchQuery}
            onChange={e => setRosterSearchQuery(e.target.value)}
            placeholder="Search personnel"
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-primary/10 bg-themewhite placeholder:text-tertiary/40 focus:border-themeblue2 focus:outline-none transition-colors"
          />
          {rosterSearchQuery && (
            <button
              onClick={() => setRosterSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary/40 hover:text-tertiary active:scale-95"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && ownClinicMedics.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-themeblue3/30 border-t-themeblue3 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No personnel"
            subtitle={rosterSearchQuery ? 'No matches found' : 'Roster is empty'}
          />
        ) : (
          <div className="py-1">
            {filtered.map(medic => {
              const isAssigned = assignedSet.has(medic.id)
              return (
                <button
                  key={medic.id}
                  onClick={() => onAssignToEvent?.(medic.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] ${
                    isAssigned
                      ? 'bg-themeblue3/8'
                      : 'hover:bg-primary/3'
                  }`}
                >
                  <div className={`${compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-full flex items-center justify-center font-semibold shrink-0 ${
                    isAssigned ? 'bg-themeblue3 text-white' : 'bg-primary/8 text-secondary'
                  }`}>
                    {getInitials(medic.firstName, medic.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-primary truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                      {formatName(medic)}
                    </p>
                    {medic.credential && (
                      <p className="text-[10px] text-tertiary/50 truncate">{medic.credential}</p>
                    )}
                  </div>
                  {isAssigned && (
                    <div className="w-2 h-2 rounded-full bg-themeblue3 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
