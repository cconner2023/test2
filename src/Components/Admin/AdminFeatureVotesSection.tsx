/**
 * AdminFeatureVotesSection — dev-only admin UI for feature voting cycles.
 *
 * Each cycle is a fixed set of up to 3 options — admin enters cycle title and
 * 1–3 option titles in a single popover at creation time.
 *
 * User-submitted suggestions are NOT managed here. They show up in the admin
 * Requests list (AdminRequestsList) alongside other feedback items.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lightbulb, Loader2, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import {
  fetchAllCycles,
  fetchCandidates,
  fetchTally,
  createCycle,
  closeCycle,
  deleteCycle,
  addCandidate,
  deleteCandidate,
  type FeatureVoteCycle,
  type FeatureVoteCandidate,
  type VoteTally,
} from '../../lib/featureVotingService'
import { EmptyState } from '../EmptyState'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorDisplay } from '../ErrorDisplay'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput } from '../FormInputs'
import { ActionButton } from '../ActionButton'

const MAX_OPTIONS_PER_CYCLE = 3

type CycleData = { candidates: FeatureVoteCandidate[]; tally: VoteTally }

export function AdminFeatureVotesSection() {
  const userId = useAuthStore((s) => s.user?.id)
  const isDevRole = useAuthStore((s) => s.isDevRole)

  const [cycles, setCycles] = useState<FeatureVoteCycle[]>([])
  const [cycleData, setCycleData] = useState<Record<string, CycleData>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // New-cycle popover state
  const newCycleBtnRef = useRef<HTMLButtonElement>(null)
  const [newCycleOpen, setNewCycleOpen] = useState(false)
  const [newCycleAnchor, setNewCycleAnchor] = useState<DOMRect | null>(null)
  const [newCycleTitle, setNewCycleTitle] = useState('')
  const [newCycleOptions, setNewCycleOptions] = useState<string[]>([''])

  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [confirmDeleteCycle, setConfirmDeleteCycle] = useState<string | null>(null)
  const [confirmCloseCycle, setConfirmCloseCycle] = useState<string | null>(null)
  const [confirmDeleteOption, setConfirmDeleteOption] = useState<{ cycleId: string; candidateId: string } | null>(null)

  const loadCycles = useCallback(async () => {
    const result = await fetchAllCycles()
    if (result.ok) {
      setCycles(result.data)
      return result.data
    }
    setError(result.error)
    return []
  }, [])

  const loadCycleData = useCallback(async (cycleId: string) => {
    const [candRes, tallyRes] = await Promise.all([
      fetchCandidates(cycleId),
      fetchTally(cycleId),
    ])
    if (candRes.ok && tallyRes.ok) {
      setCycleData((prev) => ({
        ...prev,
        [cycleId]: { candidates: candRes.data, tally: tallyRes.data },
      }))
    }
  }, [])

  useEffect(() => {
    if (!isDevRole) {
      setLoading(false)
      return
    }
    (async () => {
      setLoading(true)
      const cs = await loadCycles()
      await Promise.all(cs.map((c) => loadCycleData(c.id)))
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevRole])

  const activeCycles = useMemo(() => cycles.filter((c) => c.closedAt == null), [cycles])
  const closedCycles = useMemo(
    () => cycles.filter((c) => c.closedAt != null).slice(0, 10),
    [cycles]
  )

  const totalVotesFor = useCallback(
    (cycleId: string) =>
      Object.values(cycleData[cycleId]?.tally ?? {}).reduce((sum, n) => sum + n, 0),
    [cycleData]
  )

  const openNewCyclePopover = () => {
    setNewCycleTitle('')
    setNewCycleOptions([''])
    setNewCycleAnchor(newCycleBtnRef.current?.getBoundingClientRect() ?? null)
    setNewCycleOpen(true)
  }

  const closeNewCyclePopover = () => {
    setNewCycleOpen(false)
  }

  const updateOptionAt = (index: number, value: string) => {
    setNewCycleOptions((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

  const addOptionRow = () => {
    setNewCycleOptions((prev) => (prev.length < MAX_OPTIONS_PER_CYCLE ? [...prev, ''] : prev))
  }

  const removeOptionRow = (index: number) => {
    setNewCycleOptions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const handleCreateCycle = async () => {
    if (!userId) return
    const title = newCycleTitle.trim()
    if (!title) {
      setError('Cycle title required')
      return
    }
    const options = newCycleOptions.map((o) => o.trim()).filter(Boolean)
    if (options.length === 0) {
      setError('At least one option is required')
      return
    }

    setBusy(true)
    setError(null)

    const cycleResult = await createCycle({ title, createdBy: userId })
    if (!cycleResult.success) {
      setBusy(false)
      setError(cycleResult.error)
      return
    }

    // Create options in sequence so sort_order matches input order
    for (let i = 0; i < options.length; i++) {
      const r = await addCandidate({
        cycleId: cycleResult.cycle.id,
        title: options[i],
        sortOrder: i,
      })
      if (!r.success) {
        setBusy(false)
        setError(`Cycle created but option "${options[i]}" failed: ${r.error}`)
        await loadCycles()
        await loadCycleData(cycleResult.cycle.id)
        return
      }
    }

    setBusy(false)
    setNewCycleOpen(false)
    await loadCycles()
    await loadCycleData(cycleResult.cycle.id)
  }

  const handleCloseCycle = async (cycleId: string) => {
    setBusy(true)
    setError(null)
    const result = await closeCycle(cycleId)
    setBusy(false)
    setConfirmCloseCycle(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (editingCycleId === cycleId) setEditingCycleId(null)
    await loadCycles()
  }

  const handleDeleteCycle = async (cycleId: string) => {
    setBusy(true)
    setError(null)
    const result = await deleteCycle(cycleId)
    setBusy(false)
    setConfirmDeleteCycle(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (editingCycleId === cycleId) setEditingCycleId(null)
    setCycleData((prev) => {
      const next = { ...prev }
      delete next[cycleId]
      return next
    })
    await loadCycles()
  }

  const handleDeleteOption = async (cycleId: string, candidateId: string) => {
    setBusy(true)
    setError(null)
    const result = await deleteCandidate(candidateId)
    setBusy(false)
    setConfirmDeleteOption(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    await loadCycleData(cycleId)
  }

  if (!isDevRole) {
    return (
      <div className="px-5 py-8">
        <EmptyState
          icon={<Lock size={28} />}
          title="Dev role required"
          description="Feature voting administration is restricted to developers."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-5 py-8 flex items-center justify-center text-tertiary">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  const canAddMoreOptions = newCycleOptions.length < MAX_OPTIONS_PER_CYCLE
  const trimmedOptionCount = newCycleOptions.filter((o) => o.trim()).length

  return (
    <div className="pb-24">
      <div className="px-5 py-4 space-y-5">

        {error && <ErrorDisplay message={error} />}

        {/* Active cycles — each rendered as a theme-picker-style card */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Active cycles</p>
            <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-lg border border-tertiary/15">
              <button
                ref={newCycleBtnRef}
                onClick={openNewCyclePopover}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-themeblue2 text-white active:scale-95 transition-all"
                aria-label="New cycle"
                title="New cycle"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {activeCycles.length === 0 ? (
            <div className="flex items-center justify-center h-[80px]">
              <span className="text-xs text-secondary">No active cycles</span>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCycles.map((cycle) => {
                const data = cycleData[cycle.id]
                const candidates = data?.candidates ?? []
                const tally = data?.tally ?? {}
                const total = totalVotesFor(cycle.id)
                const isEditing = editingCycleId === cycle.id

                return (
                  <div
                    key={cycle.id}
                    className="w-full rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden"
                  >
                    {/* Options body */}
                    {candidates.length === 0 ? (
                      <div className="flex items-center justify-center h-[60px]">
                        <span className="text-xs text-secondary">No options in this cycle</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-themeblue3/10">
                        {candidates.map((c) => {
                          const voteCount = tally[c.id] ?? 0
                          const pct = total > 0 ? Math.round((voteCount / total) * 100) : 0
                          return (
                            <div key={c.id} className="relative px-4 py-3">
                              <div
                                className="absolute inset-y-0 left-0 bg-themeblue2/10 pointer-events-none"
                                style={{ width: `${pct}%` }}
                                aria-hidden="true"
                              />
                              <div className="relative flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-primary">{c.title}</p>
                                  {c.description && <p className="text-[9pt] text-tertiary mt-0.5">{c.description}</p>}
                                  {c.sourceSuggestionId && (
                                    <p className="text-[9pt] text-themeyellow mt-0.5 flex items-center gap-1">
                                      <Lightbulb size={10} /> From a user suggestion
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold text-primary">{pct}%</p>
                                  <p className="text-[9pt] text-tertiary">{voteCount}</p>
                                </div>
                                {isEditing && (
                                  <button
                                    onClick={() => setConfirmDeleteOption({ cycleId: cycle.id, candidateId: c.id })}
                                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all"
                                    aria-label="Delete option"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Info row: cycle title + action pill (theme-picker pattern) */}
                    <div className="flex items-center gap-3 px-4 py-3 border-t border-themeblue3/10">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{cycle.title}</p>
                        {cycle.description && (
                          <p className="text-[9pt] text-tertiary mt-0.5 line-clamp-1">{cycle.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-lg border border-tertiary/15 shrink-0">
                        <button
                          onClick={() => setEditingCycleId((prev) => (prev === cycle.id ? null : cycle.id))}
                          className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                            isEditing ? 'bg-themeblue2 text-white' : 'bg-themeblue2/8 text-primary'
                          }`}
                          aria-label={isEditing ? 'Done editing' : 'Edit options'}
                          title={isEditing ? 'Done editing' : 'Edit options'}
                        >
                          {isEditing ? <Check size={14} /> : <Pencil size={14} />}
                        </button>
                        <button
                          onClick={() => setConfirmCloseCycle(cycle.id)}
                          className="w-9 h-9 rounded-full flex items-center justify-center bg-themeyellow/15 text-themeyellow active:scale-95 transition-all"
                          aria-label="Close cycle"
                          title="Close cycle"
                        >
                          <Lock size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteCycle(cycle.id)}
                          className="w-9 h-9 rounded-full flex items-center justify-center bg-themeredred/15 text-themeredred active:scale-95 transition-all"
                          aria-label="Delete cycle"
                          title="Delete cycle"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Past cycles — compact list, historical only */}
        {closedCycles.length > 0 && (
          <div>
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-2">Past cycles</p>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-themeblue3/10">
              {closedCycles.map((c) => {
                const total = totalVotesFor(c.id)
                return (
                  <div key={c.id} className="px-4 py-2.5 flex items-center gap-3">
                    <Lock size={12} className="text-tertiary shrink-0" />
                    <p className="text-sm text-primary truncate flex-1">{c.title}</p>
                    <span className="text-[9pt] text-tertiary shrink-0">
                      {total} vote{total === 1 ? '' : 's'}
                    </span>
                    <button
                      onClick={() => setConfirmDeleteCycle(c.id)}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all"
                      aria-label="Delete cycle"
                      title="Delete cycle"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* New cycle popover — cycle title + up to 3 option inputs */}
      <PreviewOverlay
        isOpen={newCycleOpen}
        onClose={closeNewCyclePopover}
        anchorRect={newCycleAnchor}
        title="New cycle"
        maxWidth={340}
        footer={
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton
              icon={busy ? Loader2 : Check}
              label={busy ? 'Saving…' : 'Open cycle'}
              onClick={handleCreateCycle}
              variant={busy || !newCycleTitle.trim() || trimmedOptionCount === 0 ? 'disabled' : 'success'}
            />
          </div>
        }
      >
        <div className="p-4 space-y-3">
          <div>
            <TextInput
              value={newCycleTitle}
              onChange={setNewCycleTitle}
              placeholder="title"
              maxLength={120}
            />
          </div>

          <div>
            <div className="space-y-1.5">
              {newCycleOptions.map((opt, idx) => {
                const isLast = idx === newCycleOptions.length - 1
                return (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      <TextInput
                        value={opt}
                        onChange={(v) => updateOptionAt(idx, v)}
                        placeholder={newCycleOptions.length > 1 ? `feature ${idx + 1}` : 'feature'}
                        maxLength={120}
                      />
                    </div>
                    {isLast && canAddMoreOptions ? (
                      <button
                        type="button"
                        onClick={addOptionRow}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-themeblue3 text-white active:scale-95 transition-all"
                        aria-label="Add option"
                      >
                        <Plus size={14} />
                      </button>
                    ) : newCycleOptions.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeOptionRow(idx)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                        aria-label="Remove option"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmCloseCycle}
        title="Close this cycle?"
        subtitle="No new votes can be cast after closing. Options and votes are preserved."
        confirmLabel="Close"
        variant="warning"
        processing={busy}
        onConfirm={() => confirmCloseCycle && handleCloseCycle(confirmCloseCycle)}
        onCancel={() => setConfirmCloseCycle(null)}
      />

      <ConfirmDialog
        visible={!!confirmDeleteCycle}
        title="Delete this cycle?"
        subtitle="Permanent. All options and votes will be deleted."
        confirmLabel="Delete"
        variant="danger"
        processing={busy}
        onConfirm={() => confirmDeleteCycle && handleDeleteCycle(confirmDeleteCycle)}
        onCancel={() => setConfirmDeleteCycle(null)}
      />

      <ConfirmDialog
        visible={!!confirmDeleteOption}
        title="Delete this option?"
        subtitle="Permanent. Existing votes for this option will be removed."
        confirmLabel="Delete"
        variant="danger"
        processing={busy}
        onConfirm={() => confirmDeleteOption && handleDeleteOption(confirmDeleteOption.cycleId, confirmDeleteOption.candidateId)}
        onCancel={() => setConfirmDeleteOption(null)}
      />
    </div>
  )
}
