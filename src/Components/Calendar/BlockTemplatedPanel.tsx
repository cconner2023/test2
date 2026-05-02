import { useState, useMemo, useImperativeHandle, forwardRef } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { MultiPickerInput, DatePickerInput } from '../FormInputs'
import { useAuthStore } from '../../stores/useAuthStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { getInitials } from '../../Utilities/nameUtils'

export interface BlockTemplatedHandle {
  submit: () => void
  canSubmit: boolean
}

interface BlockTemplatedPanelProps {
  clinicId: string
  onDone: () => void
}

const PREVIEW_LIMIT = 8

function formatSlot(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`
}

export const BlockTemplatedPanel = forwardRef<BlockTemplatedHandle, BlockTemplatedPanelProps>(
  function BlockTemplatedPanel({ clinicId, onDone }, ref) {
    const isSupervisor = useAuthStore(s => s.isSupervisorRole)
    const { medics } = useClinicMedics()
    const events = useCalendarStore(s => s.events)
    const { deleteEvent } = useCalendarWrite()

    const [providerIds, setProviderIds] = useState<string[]>([])
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [confirming, setConfirming] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

    const providerOptions = useMemo(
      () => medics
        .filter(m => m.roles?.includes('provider') && m.clinicId === clinicId)
        .map(p => ({
          value: p.id,
          label: [p.rank, p.lastName, p.firstName ? p.firstName.charAt(0) + '.' : null]
            .filter(Boolean).join(' ') || getInitials(p.firstName, p.lastName) || 'Provider',
        })),
      [medics, clinicId]
    )

    const matched = useMemo(() => {
      if (providerIds.length === 0 || !fromDate || !toDate) return []
      const fromISO = `${fromDate}T00:00`
      const toISO = `${toDate}T23:59`
      return events.filter(e =>
        e.category === 'templated'
        && e.assigned_to.some(a => providerIds.includes(a))
        && e.start_time >= fromISO
        && e.start_time <= toISO
      )
    }, [events, providerIds, fromDate, toDate])

    const canSubmit = isSupervisor && providerIds.length > 0 && !!fromDate && !!toDate && matched.length > 0 && !deleting

    async function handleConfirmedDelete() {
      setConfirming(false)
      setDeleting(true)
      setProgress({ done: 0, total: matched.length })

      for (let i = 0; i < matched.length; i++) {
        try { await deleteEvent(matched[i].id) } catch { /* per-slot failure doesn't abort the run */ }
        setProgress({ done: i + 1, total: matched.length })
      }

      setDeleting(false)
      onDone()
    }

    function requestSubmit() {
      if (canSubmit) setConfirming(true)
    }

    useImperativeHandle(ref, () => ({ submit: requestSubmit, canSubmit }), [canSubmit])

    if (!isSupervisor) return null

    const sample = matched.slice(0, PREVIEW_LIMIT)
    const extra = matched.length - sample.length

    return (
      <>
        <div data-tour="block-form" className="flex flex-col h-full overflow-y-auto px-4 py-4">
          <div className="rounded-2xl overflow-hidden">
            <div data-tour="block-provider">
              <MultiPickerInput
                value={providerIds}
                onChange={setProviderIds}
                options={providerOptions}
                placeholder="Provider(s) *"
                required
              />
            </div>

            <div data-tour="block-date-range" className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <DatePickerInput
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="From"
                />
              </div>
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <DatePickerInput
                  value={toDate}
                  onChange={setToDate}
                  placeholder="To"
                  minDate={fromDate}
                />
              </div>
            </div>
          </div>

          {providerIds.length > 0 && fromDate && toDate && (
            <div data-tour="block-match" className="mt-4">
              <div className="px-1 pb-2 flex items-center gap-2">
                <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Match</p>
                <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                  {matched.length}
                </span>
                {deleting && progress && (
                  <span className="text-[9pt] text-tertiary tabular-nums ml-auto">
                    {progress.done} / {progress.total}
                  </span>
                )}
              </div>
              {matched.length === 0 ? (
                <p className="px-1 py-2 text-[10pt] text-tertiary">No templated events match this range.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto px-1 text-[10pt] font-mono text-secondary tabular-nums">
                  {sample.map(e => (
                    <div key={e.id} className="py-0.5 truncate">
                      {formatSlot(e.start_time)} — {e.title}
                    </div>
                  ))}
                  {extra > 0 && <div className="py-0.5 text-tertiary">+ {extra} more</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <ConfirmDialog
          visible={confirming}
          title={`Delete ${matched.length} templated slot${matched.length === 1 ? '' : 's'}?`}
          subtitle={
            matched.length > 0
              ? `${formatSlot(matched[0].start_time)}${matched.length > 1 ? ` … ${formatSlot(matched[matched.length - 1].start_time)}` : ''}. This cannot be undone.`
              : ''
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmedDelete}
          onCancel={() => setConfirming(false)}
        />
      </>
    )
  }
)
