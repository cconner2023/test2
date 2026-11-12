import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { listAllUsers, listClinics, type AdminUser, type AdminClinic } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { ASSIGNABLE_ROLES } from '../../Utilities/roles'
import { buildScopeIndex } from './adminScope'
import { RoleBadge } from './adminUtils'

// ── Filter model ─────────────────────────────────────────────────────────────
// Two groups. Within a group, selections OR; across groups they AND; an empty
// group passes everything. "Needs attention" flags are the questions the tree
// can't answer — who is floating, who can't do anything, who has gone quiet.

export type PeopleFlag = 'unassigned' | 'no-roles' | 'inactive'

export interface PeopleFilter {
  flags: ReadonlySet<PeopleFlag>
  roles: ReadonlySet<string>
}

export const EMPTY_PEOPLE_FILTER: PeopleFilter = { flags: new Set(), roles: new Set() }

const INACTIVE_DAYS = 30

export const PEOPLE_FLAGS: { id: PeopleFlag; label: string }[] = [
  { id: 'unassigned', label: 'No home cluster' },
  { id: 'no-roles', label: 'No roles' },
  { id: 'inactive', label: `Inactive ${INACTIVE_DAYS}+ days` },
]

const ROLE_LABEL: Record<string, string> = {
  medic: 'Medic',
  supervisor: 'Supervisor',
  dev: 'Developer',
  provider: 'Provider',
}

function hasFlag(u: AdminUser, flag: PeopleFlag, now: number): boolean {
  switch (flag) {
    case 'unassigned': return !u.clinic_id
    case 'no-roles': return (u.roles?.length ?? 0) === 0
    case 'inactive': return !u.last_active_at || now - new Date(u.last_active_at).getTime() > INACTIVE_DAYS * 86_400_000
  }
}

function matchesFilter(u: AdminUser, f: PeopleFilter, now: number): boolean {
  if (f.flags.size > 0 && ![...f.flags].some(fl => hasFlag(u, fl, now))) return false
  if (f.roles.size > 0 && !u.roles?.some(r => f.roles.has(r))) return false
  return true
}

export const isFilterActive = (f: PeopleFilter) => f.flags.size > 0 || f.roles.size > 0

const fullName = (u: AdminUser) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'User'

const userMatches = (u: AdminUser, q: string) =>
  [`${u.first_name ?? ''} ${u.last_name ?? ''}`, u.email, u.rank, u.uic, u.clinic_name, u.credential]
    .some(f => (f ?? '').toLowerCase().includes(q))

/** Users + clusters for the people views. Both reads are cache-first delta reads,
 *  so the table and the filter panel sharing them costs no extra egress. */
function useAdminPeople() {
  const gen = useInvalidation('users', 'clinics')
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  useEffect(() => {
    let cancelled = false
    void Promise.all([listAllUsers(), listClinics()]).then(([u, c]) => {
      if (cancelled) return
      setUsers(u)
      setClinics(c)
    })
    return () => { cancelled = true }
  }, [gen])
  return { users, clinics }
}

/** Ids of `rootId` and every cluster beneath it. */
function subtreeIds(clinics: AdminClinic[], rootId: string): Set<string> {
  const { clinicChildren } = buildScopeIndex(clinics)
  const out = new Set<string>()
  const walk = (id: string) => {
    if (out.has(id)) return
    out.add(id)
    for (const c of clinicChildren.get(id) ?? []) walk(c.id)
  }
  walk(rootId)
  return out
}

// ── Filter panel (rail) ──────────────────────────────────────────────────────

const filterRowCls = (active: boolean) =>
  `w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
    active ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : 'border-l-2 border-l-transparent hover:bg-secondary/5'
  }`

export function RailGroupLabel({ children }: { children: string }) {
  return (
    <div className="shrink-0 px-4 py-2 border-t border-primary/10">
      <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">{children}</p>
    </div>
  )
}

/**
 * The People filter as rail rows (Property's desktop rail idiom — the filter
 * lives in the rail above the tree, not behind chips). Counts are over the
 * whole roster so a zero tells you there's nothing to chase.
 */
export function AdminPeopleFilterPanel({ value, onChange }: { value: PeopleFilter; onChange: (f: PeopleFilter) => void }) {
  const { users } = useAdminPeople()
  const now = Date.now()
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const u of users ?? []) {
      for (const f of PEOPLE_FLAGS) if (hasFlag(u, f.id, now)) m.set(f.id, (m.get(f.id) ?? 0) + 1)
      for (const r of u.roles ?? []) m.set(`role:${r}`, (m.get(`role:${r}`) ?? 0) + 1)
    }
    return m
  }, [users]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = <T,>(set: ReadonlySet<T>, v: T): Set<T> => {
    const next = new Set(set)
    if (!next.delete(v)) next.add(v)
    return next
  }

  const row = (key: string, label: string, active: boolean, count: number | undefined, onClick: () => void) => (
    <button key={key} type="button" className={filterRowCls(active)} onClick={onClick}>
      <span className="text-[10pt] font-medium text-primary truncate flex-1">{label}</span>
      {!!count && <span className="text-[9pt] text-tertiary tabular-nums shrink-0">{count}</span>}
      {active && <Check size={14} className="text-themeblue2 shrink-0" />}
    </button>
  )

  return (
    <div className="flex flex-col">
      <RailGroupLabel>Needs attention</RailGroupLabel>
      {PEOPLE_FLAGS.map(f => row(f.id, f.label, value.flags.has(f.id), counts.get(f.id),
        () => onChange({ ...value, flags: toggle(value.flags, f.id) })))}
      <RailGroupLabel>Role</RailGroupLabel>
      {ASSIGNABLE_ROLES.map(r => row(r, ROLE_LABEL[r] ?? r, value.roles.has(r), counts.get(`role:${r}`),
        () => onChange({ ...value, roles: toggle(value.roles, r) })))}
    </div>
  )
}

// ── Table (main pane) ────────────────────────────────────────────────────────

type SortKey = 'name' | 'cluster'

interface AdminPeopleTableProps {
  searchQuery: string
  filter: PeopleFilter
  /** Narrow to this cluster and everything beneath it. */
  scopeClinicId: string | null
  activeUserId: string | null
  onSelectUser: (user: AdminUser) => void
}

/**
 * The desktop Directory's main pane: every user as a sortable table, narrowed
 * by the rail's search, filter and cluster scope. The tree answers "how is the
 * org shaped"; this answers "who do I need to act on".
 */
export function AdminPeopleTable({ searchQuery, filter, scopeClinicId, activeUserId, onSelectUser }: AdminPeopleTableProps) {
  const { users, clinics } = useAdminPeople()
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false })

  const q = searchQuery.trim().toLowerCase()
  const rows = useMemo(() => {
    if (!users) return []
    const now = Date.now()
    const scope = scopeClinicId ? subtreeIds(clinics, scopeClinicId) : null
    const out = users.filter(u =>
      (!scope || (u.clinic_id && scope.has(u.clinic_id)))
      && (!q || userMatches(u, q))
      && matchesFilter(u, filter, now))
    // listAllUsers already returns last, first order — 'name' asc is that order.
    if (sort.key === 'cluster') out.sort((a, b) => (a.clinic_name ?? '￿').localeCompare(b.clinic_name ?? '￿'))
    if (sort.desc) out.reverse()
    return out
  }, [users, clinics, scopeClinicId, q, filter, sort])

  if (!users) return null

  const header = (key: SortKey | null, label: string, className: string) => {
    const active = key && sort.key === key
    const Arrow = active && sort.desc ? ChevronUp : ChevronDown
    return key ? (
      <button
        type="button"
        onClick={() => setSort(s => ({ key, desc: s.key === key ? !s.desc : false }))}
        className={`flex items-center gap-1 text-left hover:text-primary transition-colors ${active ? 'text-primary' : ''} ${className}`}
      >
        {label}
        {active && <Arrow size={12} />}
      </button>
    ) : <span className={className}>{label}</span>
  }

  const narrowed = !!scopeClinicId || !!q || isFilterActive(filter)

  return (
    <div className="h-full flex flex-col">

      <div className="shrink-0 grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_6rem] gap-3 px-5 pt-4 pb-2 border-b border-primary/10 text-[9pt] font-semibold uppercase tracking-wider text-tertiary">
        {header('name', 'Name', '')}
        {header('cluster', 'Cluster', '')}
        {header(null, 'Roles', '')}
        {header(null, 'UIC', '')}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-6">
        {rows.length === 0 ? (
          <EmptyState title={narrowed ? 'No one matches' : 'No users yet'} bordered={false} />
        ) : rows.map(u => (
          <button
            key={u.id}
            type="button"
            onClick={() => onSelectUser(u)}
            className={`w-full grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_6rem] gap-3 items-center px-5 py-2.5 text-left border-b border-primary/6 border-l-2 transition-colors ${
              activeUserId === u.id ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent hover:bg-secondary/5'
            }`}
          >
            <span className="min-w-0">
              <span className="block text-[10pt] font-medium text-primary truncate">
                {u.rank && <span className="text-tertiary font-normal">{u.rank} </span>}
                {fullName(u)}
              </span>
              <span className="block text-[9pt] text-tertiary truncate">{[u.credential, u.email].filter(Boolean).join(' · ')}</span>
            </span>
            <span className={`text-[10pt] truncate ${u.clinic_name ? 'text-secondary' : 'text-tertiary italic'}`}>
              {u.clinic_name ?? 'Unassigned'}
            </span>
            <span className="flex items-center gap-1 min-w-0 overflow-hidden">
              {(u.roles ?? []).length > 0
                ? u.roles.map(r => <RoleBadge key={r} role={r} />)
                : <span className="text-[9pt] text-tertiary italic">None</span>}
            </span>
            <span className="text-[10pt] text-secondary tabular-nums truncate">{u.uic ?? ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
