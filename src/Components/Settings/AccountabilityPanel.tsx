import { useState, useMemo, useCallback } from 'react'
import { Search, ChevronDown, ChevronRight, FileText, RotateCcw, Building2, UserRound, MapPin } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useAuthStore } from '../../stores/useAuthStore'
import { useHandReceipts } from '../../Hooks/useHandReceipts'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import { PdfPreviewModal } from '../PdfPreviewModal'
import { ConfirmDialog } from '../ConfirmDialog'
import { signInReceipt } from '../../lib/propertyService'
import { invalidate } from '../../stores/useInvalidationStore'
import type { HandReceipt, HolderInfo } from '../../Types/PropertyTypes'

/** Short, human relative date (the receipt list is chronological). */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * DA 2062 accountability surface (Settings). A searchable, chronological list of
 * hand receipts — what's signed out, to whom, and where each item usually lives.
 * Each open receipt can be reprinted or signed back in.
 */
export const AccountabilityPanel = () => {
  const { clinicId: assignedClinicId, supervisingClinicId } = useAuth()
  const clinicId = supervisingClinicId ?? assignedClinicId
  const { receipts, itemsById, locationNameById, membersById, loading, refetch } = useHandReceipts(clinicId)
  const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview } = useDA2062Export()

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingSignIn, setPendingSignIn] = useState<HandReceipt | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return receipts
    return receipts.filter((r) => {
      if (r.recipientLabel.toLowerCase().includes(q)) return true
      return r.entries.some((e) => itemsById.get(e.item_id)?.name.toLowerCase().includes(q))
    })
  }, [receipts, query, itemsById])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleReprint = useCallback(
    async (r: HandReceipt) => {
      const items = r.entries
        .map((e) => itemsById.get(e.item_id))
        .filter((i): i is NonNullable<typeof i> => !!i)
      const fromHolder: HolderInfo = membersById.get(r.recordedBy) ?? {
        id: r.recordedBy,
        rank: null,
        firstName: null,
        lastName: null,
        displayName: 'Hand Receipt Holder',
      }
      const toHolder: HolderInfo = {
        id: r.toHolderId ?? 'external',
        rank: null,
        firstName: null,
        lastName: null,
        displayName: r.recipientLabel,
      }
      await exportDA2062({
        items,
        fromHolder,
        toHolder,
        handReceiptNumber: `HR-${r.handReceiptId.slice(0, 8).toUpperCase()}`,
        date: formatDate(r.recordedAt),
      })
    },
    [itemsById, membersById, exportDA2062],
  )

  const handleSignIn = useCallback(async () => {
    const r = pendingSignIn
    if (!r || !clinicId) {
      setPendingSignIn(null)
      return
    }
    const userId = useAuthStore.getState().user?.id
    if (!userId) {
      setPendingSignIn(null)
      return
    }
    setBusyId(r.handReceiptId)
    setPendingSignIn(null)
    const result = await signInReceipt(
      r.handReceiptId,
      clinicId,
      r.toHolderId,
      r.entries.map((e) => e.item_id),
      userId,
    )
    setBusyId(null)
    if (result.success) {
      invalidate('properties')
      refetch()
    }
  }, [pendingSignIn, clinicId, refetch])

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 pb-4 space-y-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
        <p className="text-[10pt] text-tertiary leading-relaxed">
          Every DA 2062 hand receipt, newest first — what's signed out, to whom, and where each
          item usually lives.
        </p>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 rounded-2xl border border-primary/8 bg-themewhite2">
          <Search size={15} className="text-tertiary shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipient or item…"
            className="w-full bg-transparent py-2.5 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
          />
        </div>

        {/* Receipt list */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-primary/8 px-4 py-8 text-center">
            <p className="text-[10pt] text-tertiary">
              {loading ? 'Loading…' : query ? 'No receipts match.' : 'No hand receipts yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((r) => {
              const isOpen = expanded.has(r.handReceiptId)
              const returned = r.status === 'returned'
              return (
                <div
                  key={r.handReceiptId}
                  className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden"
                >
                  {/* Header row */}
                  <button
                    onClick={() => toggle(r.handReceiptId)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5"
                  >
                    <div className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
                      {r.isExternal ? (
                        <Building2 size={18} className="text-tertiary" />
                      ) : (
                        <UserRound size={18} className="text-tertiary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{r.recipientLabel}</p>
                      <p className="text-[9pt] text-tertiary mt-0.5">
                        {formatDate(r.recordedAt)} · {r.entries.length}{' '}
                        {r.entries.length === 1 ? 'item' : 'items'}
                        {r.isExternal ? ' · outside cluster' : ''}
                      </p>
                    </div>
                    {returned ? (
                      <span className="text-[8pt] font-semibold uppercase tracking-wide text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full shrink-0">
                        Returned
                      </span>
                    ) : (
                      <span className="text-[8pt] font-semibold uppercase tracking-wide text-themeblue3 bg-themeblue3/10 px-2 py-0.5 rounded-full shrink-0">
                        Signed out
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown size={16} className="text-tertiary shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-tertiary shrink-0" />
                    )}
                  </button>

                  {/* Expanded body */}
                  {isOpen && (
                    <div className="border-t border-primary/6">
                      {r.entries.map((e) => {
                        const item = itemsById.get(e.item_id)
                        const loc = item?.location_id ? locationNameById.get(item.location_id) : null
                        return (
                          <div
                            key={e.id}
                            className="px-4 py-2.5 border-b border-primary/6 last:border-b-0"
                          >
                            <p className="text-sm text-primary truncate">
                              {item?.name ?? 'Unknown item'}
                            </p>
                            <p className="text-[9pt] text-tertiary mt-0.5 flex items-center gap-1">
                              {item?.serial_number
                                ? `S/N ${item.serial_number}`
                                : item?.nsn
                                  ? `NSN ${item.nsn}`
                                  : 'No NSN'}
                              {loc && (
                                <>
                                  <span className="text-tertiary/50">·</span>
                                  <MapPin size={11} className="text-tertiary shrink-0" />
                                  usually {loc}
                                </>
                              )}
                            </p>
                          </div>
                        )
                      })}

                      {/* Actions */}
                      <div className="flex items-center gap-2 px-4 py-3">
                        <button
                          onClick={() => handleReprint(r)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-themeblue3/10 text-themeblue3 text-[10pt] font-medium active:scale-95 transition-transform"
                        >
                          <FileText size={14} />
                          Print 2062
                        </button>
                        {!returned && (
                          <button
                            onClick={() => setPendingSignIn(r)}
                            disabled={busyId === r.handReceiptId}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary/10 text-secondary text-[10pt] font-medium active:scale-95 transition-transform"
                          >
                            <RotateCcw size={14} />
                            Sign in
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <PdfPreviewModal
        preview={da2062Preview}
        onDownload={downloadDA2062}
        onClose={clearDA2062Preview}
      />

      <ConfirmDialog
        visible={!!pendingSignIn}
        title="Sign this hand receipt back in?"
        subtitle={pendingSignIn ? `${pendingSignIn.entries.length} item(s) return to the property book.` : ''}
        confirmLabel="Sign in"
        variant="primary"
        onConfirm={handleSignIn}
        onCancel={() => setPendingSignIn(null)}
      />
    </div>
  )
}
