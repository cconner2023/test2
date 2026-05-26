import { useMemo } from 'react'
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from 'lucide-react'
import { ListItemRow } from '../ListItemRow'
import { UserAvatar } from './UserAvatar'
import { getDisplayName } from '../../Utilities/nameUtils'
import type { CallHistoryEntry } from '../../Hooks/useCallHistory'

interface CallsPaneProps {
  entries: CallHistoryEntry[]
  /** Tap a row → redial the peer. */
  onRedial: (entry: CallHistoryEntry) => void
  /** Optional name filter (shares the pane's search box). */
  searchQuery?: string
}

/** mm:ss for a connected-call duration. */
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Today → time; this year → "Mon 3"; else with year. */
function fmtWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(undefined, sameYear
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' })
}

function CallRow({ entry, onRedial }: { entry: CallHistoryEntry; onRedial: (e: CallHistoryEntry) => void }) {
  const missed = entry.outcome === 'missed' || entry.outcome === 'declined' || entry.outcome === 'failed'
  const Icon = missed ? PhoneMissed : entry.direction === 'in' ? PhoneIncoming : PhoneOutgoing
  const tint = missed ? 'text-themeredred' : 'text-tertiary'

  const label = (() => {
    switch (entry.outcome) {
      case 'missed': return 'Missed call'
      case 'declined': return entry.direction === 'in' ? 'Declined' : 'No answer'
      case 'failed': return 'Failed'
      default: return entry.direction === 'in' ? 'Incoming' : 'Outgoing'
    }
  })()

  const detail = [label]
  if (entry.outcome === 'answered' && entry.durationSec > 0) detail.push(fmtDuration(entry.durationSec))

  return (
    <ListItemRow
      onClick={() => onRedial(entry)}
      className="px-4 py-4 transition-all duration-150 hover:bg-primary/3 active:scale-[0.98] cursor-pointer"
      left={<UserAvatar avatarId={entry.peer.avatarId} firstName={entry.peer.firstName} lastName={entry.peer.lastName} className="w-10 h-10" />}
      center={
        <>
          <p className={`text-sm font-medium truncate ${missed ? 'text-themeredred' : 'text-primary'}`}>{getDisplayName(entry.peer)}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${tint}`} />
            {entry.mode === 'video' && <Video className="w-3.5 h-3.5 shrink-0 text-tertiary" />}
            <p className="text-[10pt] text-tertiary truncate">{detail.join(' · ')}</p>
          </div>
        </>
      }
      right={<span className="text-[9pt] text-tertiary shrink-0">{fmtWhen(entry.at)}</span>}
    />
  )
}

/** The "Calls" lens — call history list; tapping a row redials the peer. */
export function CallsPane({ entries, onRedial, searchQuery }: CallsPaneProps) {
  const filtered = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e => getDisplayName(e.peer).toLowerCase().includes(q))
  }, [entries, searchQuery])

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-16">
        <p className="text-sm text-tertiary">No calls yet</p>
        <p className="text-[10pt] text-thememuted mt-1">Your call history will appear here.</p>
      </div>
    )
  }

  return (
    <div className="pt-1 pb-10">
      {filtered.map(entry => (
        <CallRow key={entry.callId} entry={entry} onRedial={onRedial} />
      ))}
    </div>
  )
}
