import { useMemo } from 'react'
import { Building2, Users } from 'lucide-react'
import { UserAvatar } from '../UserAvatar'
import { SupervisorClinicFilterPanel } from '../../SupervisorClinicSwitcher'
import { SubjectCard, type SubjectCardProps } from '../SubjectCard'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { SupervisorTree, type TreeSelection } from './SupervisorTree'
import { formatMedicName, rollupReadiness, medicsInSubCluster } from './supervisorHelpers'
import { useSubClusters } from '../../../Hooks/useSubClusters'
import type { ChildClinicCard } from '../../../Hooks/useEchelonSummaries'
import type { TeamMetrics, SoldierReadinessEntry } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'

/**
 * The supervisor rail — the pinned SubjectCard, the operating-as picker,
 * and the personnel tree. ONE component for the desktop left pane and the mobile
 * sheet's root step, the way CalendarDrawer renders the same filter stack into
 * its rail and its settings Sheet.
 *
 * Layout mirrors that rail (CalendarDrawer.tsx:374-407): search pins at the very
 * top, the context object under it, everything list-shaped scrolls below. The
 * sheet drops the top two — see `showCard` — so it is roster and nothing else.
 *
 * Search is rendered here only when `onSearchChange` is passed, which is the
 * desktop pane and nowhere else. Mobile has no personnel search: the rail is a
 * sheet there, so the box would either sit inside the navigator it exists to
 * shortcut, or sit in the header and have to open that sheet on focus.
 *
 * In a sheet that pinning is wrong — the sheet already owns one scroll, so a
 * second one inside it means two scrollable regions stacked in a short viewport,
 * each stealing the other's gesture. `scrollable={false}` renders the same
 * content in plain flow and lets the host scroll it as one.
 */
interface SupervisorRailProps {
  medics: ClinicMedic[]
  clinicName?: string | null
  teamMetrics: TeamMetrics
  /** Direct child clusters + their published rollups. Fetched by the DRAWER and
   *  handed down: the center pane renders a selected child's training from the
   *  same summaries, and a second useEchelonSummaries here would mean two RPCs
   *  and two IDB reads for one roster. */
  childClusters: ChildClinicCard[]
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
  /** Name filter for the tree. */
  searchQuery?: string
  /** Pass to render the search box at the top of the rail. Desktop only — the
   *  mobile sheet omits it and the query stays empty there. */
  onSearchChange?: (value: string) => void
  /** Pin the card and scroll the list below it (the desktop rail). False lets
   *  the host own the single scroll (the mobile sheet). */
  scrollable?: boolean
  /** Head the rail with the pinned subject. Off in the mobile sheet, where the
   *  card heads the center content instead — a sheet you opened to pick someone
   *  should show the roster, not spend its first 200px restating the pick you are
   *  there to change. */
  showCard?: boolean
  /** Handed to the pinned card: while a single ICTL is open the card carries that
   *  task's coverage instead of the subject's two training bars. */
  stat?: SubjectCardProps['stat']
}

export function SupervisorRail({
  medics,
  clinicName,
  teamMetrics,
  childClusters,
  selection,
  onSelect,
  searchQuery = '',
  onSearchChange,
  scrollable = true,
  showCard = true,
  stat,
}: SupervisorRailProps) {
  const statById = useMemo(() => {
    const m = new Map<string, SoldierReadinessEntry>()
    for (const s of teamMetrics.soldierReadiness) m.set(s.soldierId, s)
    return m
  }, [teamMetrics.soldierReadiness])

  const card = showCard ? (
    <SupervisorSubjectCard
      medics={medics}
      clinicName={clinicName}
      teamMetrics={teamMetrics}
      childClusters={childClusters}
      selection={selection}
      stat={stat}
    />
  ) : null

  // Mobile has no search row, so the pad stands in for the row that isn't there
  // and keeps the list off the sheet's own chrome.
  const head = (
    <>
      {onSearchChange ? (
        <div className="px-3 py-2">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search personnel"
          />
        </div>
      ) : (
        <div className="pt-3" />
      )}
      {card}
    </>
  )

  const list = (
    <>
      <SupervisorClinicFilterPanel />
      <SupervisorTree
        medics={medics}
        clinicName={clinicName}
        statById={statById}
        selection={selection}
        onSelect={onSelect}
        searchQuery={searchQuery}
        childClusters={childClusters}
      />
    </>
  )

  if (!scrollable) {
    return <>{head}{list}</>
  }

  return (
    <>
      <div className="shrink-0">{head}</div>
      <div className="flex-1 min-h-0 overflow-y-auto">{list}</div>
    </>
  )
}

/**
 * The pinned subject, resolved from the tree selection. Lives apart from the rail
 * because on mobile it is NOT in the rail: the sheet is the roster and nothing
 * else, and the card introduces the center content instead — the subject you are
 * reading about heads the thing you are reading. Same component both places, so
 * the two surfaces cannot drift.
 */
export function SupervisorSubjectCard({
  medics,
  clinicName,
  teamMetrics,
  childClusters,
  selection,
  coverHeightClass,
  coverLeft,
  coverRight,
  stickyCover,
  stat,
}: Pick<SupervisorRailProps, 'medics' | 'clinicName' | 'teamMetrics' | 'childClusters' | 'selection'> &
  Pick<SubjectCardProps, 'coverHeightClass' | 'coverLeft' | 'coverRight' | 'stickyCover' | 'stat'>) {
  const { subClusters } = useSubClusters()
  const knownSubClusterIds = useMemo(
    () => new Set(subClusters.map(s => s.id)),
    [subClusters],
  )

  return (() => {
    if (selection.type === 'soldier') {
      const soldier = medics.find(m => m.id === selection.soldierId)
      const entry = teamMetrics.soldierReadiness.find(s => s.soldierId === selection.soldierId)
      if (!soldier) return null
      return (
        <SubjectCard
          coverHeightClass={coverHeightClass}
          coverLeft={coverLeft}
          coverRight={coverRight}
          stickyCover={stickyCover}
          stat={stat}
          icon={
            <UserAvatar
              avatarId={soldier.avatarId}
              avatarBlob={soldier.avatarBlob}
              userId={soldier.id}
              firstName={soldier.firstName}
              lastName={soldier.lastName}
              className="w-14 h-14"
            />
          }
          title={formatMedicName(soldier)}
          subtitle={
            <>
              {soldier.credential}
              {soldier.isLoanedIn && (
                <span className="text-themeblue2">
                  {soldier.credential ? ' · ' : ''}Loaned in{soldier.clinicName ? ` from ${soldier.clinicName}` : ''}
                </span>
              )}
              {!soldier.isLoanedIn && soldier.surrogateClinicId && (
                <span className="text-themeyellow">{soldier.credential ? ' · ' : ''}Loaned out</span>
              )}
            </>
          }
          readinessPercent={entry?.readinessPercent ?? 0}
          compliancePercent={entry?.compliancePercent ?? 100}
        />
      )
    }

    // One child soldier, off the attributed rows in the same fan-up. A person the
    // roster lists but the summary has no row for has simply not been published
    // yet — say so rather than draw two empty bars against their name.
    if (selection.type === 'child-soldier') {
      const child = childClusters.find(c => c.clinicId === selection.clinicId)
      const row = child?.summary?.soldiers?.find(s => s.user_id === selection.soldier.id)
      return (
        <SubjectCard
          coverHeightClass={coverHeightClass}
          coverLeft={coverLeft}
          coverRight={coverRight}
          stickyCover={stickyCover}
          stat={stat}
          icon={
            <UserAvatar
              avatarId={selection.soldier.avatarId}
              firstName={selection.soldier.firstName}
              lastName={selection.soldier.lastName}
              className="w-14 h-14"
            />
          }
          title={selection.soldier.name}
          subtitle={row ? selection.soldier.credential : 'No published readiness'}
          readinessPercent={row?.readiness_pct}
          compliancePercent={row?.cert_pct}
        />
      )
    }

    // A child cluster's numbers are whatever it last fanned up — the parent holds
    // no records to recompute them from. One that has never published gets the
    // name and no bars rather than a pair of zeroes it would have to defend.
    if (selection.type === 'child-cluster') {
      const child = childClusters.find(c => c.clinicId === selection.clinicId)
      return (
        <SubjectCard
          coverHeightClass={coverHeightClass}
          coverLeft={coverLeft}
          coverRight={coverRight}
          stickyCover={stickyCover}
          stat={stat}
          icon={
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-tertiary/10">
              <Building2 size={24} className="text-tertiary" />
            </div>
          }
          title={selection.name}
          subtitle={child?.summary ? undefined : 'No published readiness'}
          readinessPercent={child?.summary?.readiness_pct}
          compliancePercent={child?.summary?.cert_pct}
        />
      )
    }

    if (selection.type === 'sub-cluster') {
      const members = medicsInSubCluster(medics, selection.subClusterId, knownSubClusterIds)
      // Rolled up by the clinic's own definitions, not averaged from the card
      // above it: compliance is valid-certs-over-all-certs, so a soldier holding
      // ten certs moves a squad's number ten times as far as one holding one.
      const memberIds = new Set(members.map(m => m.id))
      const { readinessPercent, compliancePercent } = rollupReadiness(
        teamMetrics.soldierReadiness.filter(s => memberIds.has(s.soldierId)),
      )
      return (
        <SubjectCard
          coverHeightClass={coverHeightClass}
          coverLeft={coverLeft}
          coverRight={coverRight}
          stickyCover={stickyCover}
          stat={stat}
          icon={
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-tertiary/10">
              <Users size={24} className="text-tertiary" />
            </div>
          }
          title={selection.name}
          readinessPercent={readinessPercent}
          compliancePercent={compliancePercent}
        />
      )
    }

    return (
      <SubjectCard
        coverHeightClass={coverHeightClass}
        coverLeft={coverLeft}
        coverRight={coverRight}
        stickyCover={stickyCover}
        stat={stat}
        icon={
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-tertiary/10">
            <Building2 size={24} className="text-tertiary" />
          </div>
        }
        title={clinicName ?? 'My Cluster'}
        readinessPercent={teamMetrics.teamReadinessPercent}
        compliancePercent={teamMetrics.certCompliancePercent}
      />
    )
  })()
}
