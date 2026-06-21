import { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, FileText, RotateCcw, Building2, UserRound, MapPin } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useHandReceipts } from '../../Hooks/useHandReceipts'
import { useHandReceiptActions } from '../../Hooks/useHandReceiptActions'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { SearchInput } from '../SearchInput'
import { EmptyState } from '../EmptyState'
import { SignOutSheet } from '../Property/SignOutSheet'
import { PdfPreviewModal } from '../PdfPreviewModal'
import { ConfirmDialog } from '../ConfirmDialog'

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
  const { reprint, pendingSignIn, setPendingSignIn, confirmSignIn, busyId, da2062Preview, downloadDA2062, clearDA2062Preview } =
    useHandReceiptActions({ clinicId, itemsById, membersById, refetch })

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showSignOut, setShowSignOut] = useState(false)

  // The sign-out sheet reads its item/member lists from the property store, which is
  // only hydrated once the Property drawer has opened. Init it on demand so a DA 2062
  // can be started straight from here.
  const openSignOut = useCallback(() => {
    const ps = usePropertyStore.getState()
    if (ps.items.length === 0 && !ps.isLoading) ps.init()
    setShowSignOut(true)
  }, [])

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 pb-4 space-y-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
        {/* Search */}
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search recipient or item…"
        />

        {/* Receipt list */}
        {filtered.length === 0 ? (
          <EmptyState
            title={loading ? 'Loading…' : query ? 'No receipts match.' : 'No hand receipts yet.'}
            action={
              !loading && !query
                ? { icon: FileText, label: 'New DA 2062', onClick: openSignOut }
                : undefined
            }
          />
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
                          onClick={() => reprint(r)}
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

      <SignOutSheet
        isOpen={showSignOut}
        onClose={() => {
          setShowSignOut(false)
          refetch()
        }}
      />

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
        onConfirm={confirmSignIn}
        onCancel={() => setPendingSignIn(null)}
      />
    </div>
  )
}
