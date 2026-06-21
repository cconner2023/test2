import { useState, useMemo, useCallback } from 'react'
import { Search, Check } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Sheet } from '../Sheet'
import { TextInput } from '../FormInputs'
import { PdfPreviewModal } from '../PdfPreviewModal'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import type { HolderInfo } from '../../Types/PropertyTypes'

interface SignOutSheetProps {
  isOpen: boolean
  onClose: () => void
}

type Mode = 'member' | 'external'

/**
 * New DA 2062 — sign 1..N items out on a single hand receipt to a cluster member
 * (internal) or a free-text recipient outside the cluster (external). On confirm it
 * writes the receipt (one shared hand_receipt_id) and immediately offers the 2062 PDF.
 */
export function SignOutSheet({ isOpen, onClose }: SignOutSheetProps) {
  const store = usePropertyStore(
    useShallow((s) => ({
      items: s.items,
      locations: s.locations,
      clinicMembers: s.clinicMembers,
      signOut: s.signOut,
    })),
  )
  const profile = useAuthStore((s) => s.profile)

  const [mode, setMode] = useState<Mode>('member')
  const [toHolderId, setToHolderId] = useState<string | null>(null)
  const [externalName, setExternalName] = useState('')
  const [notes, setNotes] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [itemQuery, setItemQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview } = useDA2062Export()

  const locationName = useCallback(
    (id: string | null) => (id ? store.locations.find((l) => l.id === id)?.name ?? null : null),
    [store.locations],
  )

  // Only top-level items are signable (components ride their parent).
  const signableItems = useMemo(
    () => store.items.filter((i) => !i.parent_item_id),
    [store.items],
  )

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return store.clinicMembers
    return store.clinicMembers.filter((m) => m.displayName.toLowerCase().includes(q))
  }, [store.clinicMembers, memberQuery])

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase()
    if (!q) return signableItems
    return signableItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.nsn?.toLowerCase().includes(q) ||
        i.serial_number?.toLowerCase().includes(q),
    )
  }, [signableItems, itemQuery])

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const recipientReady = mode === 'member' ? !!toHolderId : !!externalName.trim()
  const canSubmit = recipientReady && selectedIds.size > 0 && !busy

  const reset = useCallback(() => {
    setMode('member')
    setToHolderId(null)
    setExternalName('')
    setNotes('')
    setMemberQuery('')
    setItemQuery('')
    setSelectedIds(new Set())
    setBusy(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setBusy(true)
    const itemIds = signableItems.filter((i) => selectedIds.has(i.id)).map((i) => i.id)
    const handReceiptId = await store.signOut({
      itemIds,
      toHolderId: mode === 'member' ? toHolderId : null,
      externalName: mode === 'external' ? externalName.trim() : null,
      notes: notes.trim() || null,
    })
    if (!handReceiptId) {
      setBusy(false)
      return
    }

    // Build + offer the DA 2062 for the receipt just written.
    const fromHolder: HolderInfo = {
      id: 'self',
      rank: profile.rank ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      displayName:
        [profile.rank, profile.lastName, profile.firstName].filter(Boolean).join(' ') ||
        'Hand Receipt Holder',
    }
    const toHolder: HolderInfo =
      mode === 'member'
        ? store.clinicMembers.find((m) => m.id === toHolderId) ?? {
            id: toHolderId ?? 'unknown',
            rank: null,
            firstName: null,
            lastName: null,
            displayName: 'Member',
          }
        : { id: 'external', rank: null, firstName: null, lastName: null, displayName: externalName.trim() }

    const items = signableItems.filter((i) => selectedIds.has(i.id))
    await exportDA2062({
      items,
      fromHolder,
      toHolder,
      handReceiptNumber: `HR-${handReceiptId.slice(0, 8).toUpperCase()}`,
      date: new Date().toLocaleDateString(),
    })
    setBusy(false)
  }, [canSubmit, signableItems, selectedIds, store, mode, toHolderId, externalName, notes, profile, exportDA2062])

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={handleClose}
        title="New DA 2062"
        maxHeight={90}
      >
        <div className="px-4 pb-6 space-y-5">
          {/* ── Recipient ── */}
          <div className="space-y-2">
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest px-1">
              Sign to
            </p>
            <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {(['member', 'external'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`shrink-0 px-4 py-1.5 text-sm ${
                    mode === m
                      ? 'bg-themeblue3 text-white font-medium'
                      : 'text-secondary active:bg-tertiary/5'
                  }`}
                >
                  {m === 'member' ? 'Cluster member' : 'Outside cluster'}
                </button>
              ))}
            </div>

            {mode === 'member' ? (
              <div className="rounded-2xl border border-primary/8 overflow-hidden">
                <div className="flex items-center gap-2 px-3 border-b border-primary/6">
                  <Search size={15} className="text-tertiary shrink-0" />
                  <input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Search members…"
                    className="w-full bg-transparent py-2.5 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filteredMembers.map((m) => {
                    const selected = toHolderId === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => setToHolderId(m.id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left active:bg-tertiary/5 border-b border-primary/6 last:border-b-0"
                      >
                        <span className={`text-sm ${selected ? 'text-primary font-medium' : 'text-secondary'}`}>
                          {m.displayName}
                        </span>
                        {selected && <Check size={16} className="text-themeblue3 shrink-0" />}
                      </button>
                    )
                  })}
                  {filteredMembers.length === 0 && (
                    <p className="px-4 py-3 text-[10pt] text-tertiary">No members match.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/8 overflow-hidden">
                <TextInput
                  value={externalName}
                  onChange={setExternalName}
                  placeholder="Recipient — unit / name (e.g. 3-7 CAV, SGT Doe)"
                />
              </div>
            )}
          </div>

          {/* ── Items ── */}
          <div className="space-y-2">
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest px-1">
              Items {selectedIds.size > 0 && <span className="text-themeblue3">· {selectedIds.size} selected</span>}
            </p>
            <div className="rounded-2xl border border-primary/8 overflow-hidden">
              <div className="flex items-center gap-2 px-3 border-b border-primary/6">
                <Search size={15} className="text-tertiary shrink-0" />
                <input
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Search items…"
                  className="w-full bg-transparent py-2.5 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredItems.map((i) => {
                  const selected = selectedIds.has(i.id)
                  const loc = locationName(i.location_id)
                  const out = i.signed_out_external || !!i.current_holder_id
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggleItem(i.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-tertiary/5 border-b border-primary/6 last:border-b-0"
                    >
                      <span
                        className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center border ${
                          selected ? 'bg-themeblue3 border-themeblue3' : 'border-tertiary/40'
                        }`}
                      >
                        {selected && <Check size={14} className="text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-primary truncate">{i.name}</span>
                        <span className="block text-[10pt] text-tertiary truncate">
                          {i.serial_number ? `S/N ${i.serial_number}` : i.nsn ? `NSN ${i.nsn}` : 'No NSN'}
                          {loc ? ` · usually ${loc}` : ''}
                          {out ? ' · already out' : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {filteredItems.length === 0 && (
                  <p className="px-4 py-3 text-[10pt] text-tertiary">No items match.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="rounded-2xl border border-primary/8 overflow-hidden">
            <TextInput value={notes} onChange={setNotes} placeholder="Notes (optional)" />
          </div>

          {/* ── Confirm (contextual; only when valid) ── */}
          {canSubmit && (
            <button
              onClick={handleSubmit}
              className="w-full py-3 rounded-full bg-themeblue3 text-white font-semibold text-sm active:scale-95 transition-all shadow-lg"
            >
              Sign out {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} on a DA 2062
            </button>
          )}
        </div>
      </Sheet>

      <PdfPreviewModal
        preview={da2062Preview}
        onDownload={downloadDA2062}
        onClose={() => {
          clearDA2062Preview()
          handleClose()
        }}
      />
    </>
  )
}
