import { useState, useMemo, useRef } from 'react'
import { Search, X, Users } from 'lucide-react'
import { SwipeableRosterCard } from './SwipeableRosterCard'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

interface PersonnelRosterProps {
  medics: ClinicMedic[]
  certsForSoldier: (userId: string) => Certification[]
  overdueCount: (userId: string) => number
  selectedSoldierId: string | null
  onSelectSoldier: (id: string | null) => void
  onEvaluate: (soldier: ClinicMedic) => void
  onView: (soldier: ClinicMedic) => void
  onModify: (soldier: ClinicMedic) => void
}

export function PersonnelRoster({
  medics,
  certsForSoldier,
  overdueCount,
  selectedSoldierId,
  onSelectSoldier,
  onEvaluate,
  onView,
  onModify,
}: PersonnelRosterProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredMedics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return medics
    return medics.filter(m => {
      const name = formatMedicName(m).toLowerCase()
      const cred = (m.credential ?? '').toLowerCase()
      return name.includes(q) || cred.includes(q)
    })
  }, [medics, searchQuery])

  if (medics.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={28} className="mx-auto mb-3 text-tertiary/30" />
        <p className="text-sm text-tertiary/60">No medics found in your clinic</p>
      </div>
    )
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search personnel..."
          className="w-full pl-8 pr-8 py-2 rounded-lg bg-themewhite2 text-sm text-primary
                     placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-tertiary/10 transition-colors"
          >
            <X size={14} className="text-tertiary/50" />
          </button>
        )}
      </div>

      {searchQuery.trim() && (
        <p className="text-[10px] text-tertiary/50 mb-2">
          {filteredMedics.length} result{filteredMedics.length !== 1 ? 's' : ''}
        </p>
      )}

      {filteredMedics.length === 0 && searchQuery.trim() ? (
        <p className="text-sm text-tertiary/40 text-center py-8">No personnel match your search.</p>
      ) : (
        <div className="space-y-2">
          {filteredMedics.map((soldier) => {
            const menuOpen = openMenuId === soldier.id
            return (
              <SwipeableRosterCard
                key={soldier.id}
                soldier={soldier}
                certs={certsForSoldier(soldier.id)}
                overdueCount={overdueCount(soldier.id)}
                isOpen={openCardId === soldier.id}
                isSelected={selectedSoldierId === soldier.id}
                menuOpen={menuOpen}
                onOpen={() => { setOpenMenuId(null); setOpenCardId(soldier.id); onSelectSoldier(soldier.id) }}
                onClose={() => setOpenCardId(prev => prev === soldier.id ? null : prev)}
                onTap={() => {
                  setOpenCardId(null)
                  const isTogglingOff = menuOpen
                  setOpenMenuId(isTogglingOff ? null : soldier.id)
                  onSelectSoldier(isTogglingOff ? null : soldier.id)
                }}
                onEvaluate={() => { setOpenMenuId(null); onEvaluate(soldier) }}
                onView={() => { setOpenMenuId(null); onView(soldier) }}
                onModify={() => { setOpenMenuId(null); onModify(soldier) }}
              />
            )
          })}
        </div>
      )}

    </div>
  )
}
