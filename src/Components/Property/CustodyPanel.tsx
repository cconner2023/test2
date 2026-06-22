import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  FileText,
  RotateCcw,
} from 'lucide-react'
import type { ReceiptItem, HandReceiptData } from '../../Hooks/useHandReceipts'
import { useHandReceiptActions } from '../../Hooks/useHandReceiptActions'
import { PdfPreviewModal } from '../PdfPreviewModal'
import { ConfirmDialog } from '../ConfirmDialog'
import type { HandReceipt } from '../../Types/PropertyTypes'

/** Short, human date for the receipt rows (chronological, newest first). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface CustodyPanelProps {
  clinicId: string
  /** Hand-receipt data — lifted to PropertyPanel so this tab and the unified
   *  search overlay share one fetch. */
  receipts: HandReceiptData['receipts']
  itemsById: HandReceiptData['itemsById']
  locationNameById: HandReceiptData['locationNameById']
  membersById: HandReceiptData['membersById']
  loading: HandReceiptData['loading']
  refetch: HandReceiptData['refetch']
  /** Fly the map to a signed-out item's usual zone and surface it ("target the equipment"). */
  onLocateItem: (item: ReceiptItem) => void
}

/**
 * Custody tab — the DA 2062 hand receipts as their own tree, the sibling of the
 * List (locations) tab. Two groups, "Signed Out" (open receipts) and "History"
 * (returned). Deliberately icon-light and count-free: a receipt is just recipient
 * + date, expanding inline to its items + Print 2062 / Sign in. SEARCH is NOT here
 * — it lives in the single property header search (PropertySearchOverlay), which
 * folds receipts in as a "Sign-outs" section. Shares the reprint / sign-in
 * lifecycle via useHandReceiptActions; data is supplied by the parent.
 */
export function CustodyPanel({
  clinicId,
  receipts,
  itemsById,
  locationNameById,
  membersById,
  loading,
  refetch,
  onLocateItem,
}: CustodyPanelProps) {
  const {
    reprint,
    pendingSignIn,
    setPendingSignIn,
    confirmSignIn,
    busyId,
    da2062Preview,
    downloadDA2062,
    clearDA2062Preview,
  } = useHandReceiptActions({ clinicId, itemsById, membersById, refetch })

  // Group keys: '__signed_out__' (default expanded), '__history__' (default
  // collapsed), plus each receipt's handReceiptId.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['__signed_out__']))
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const { outstanding, history } = useMemo(() => {
    const outstanding: HandReceipt[] = []
    const history: HandReceipt[] = []
    for (const r of receipts) {
      ;(r.status === 'returned' ? history : outstanding).push(r)
    }
    return { outstanding, history }
  }, [receipts])

  const renderReceipt = (r: HandReceipt) => {
    const open = expanded.has(r.handReceiptId)
    const returned = r.status === 'returned'
    return (
      <div key={r.handReceiptId}>
        {/* Receipt row — recipient + date only (no icon, no count). */}
        <div
          role="button"
          tabIndex={0}
          className="group flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer border-l-2 border-l-transparent hover:bg-secondary/5"
          style={{ paddingLeft: '36px' }}
          onClick={() => toggle(r.handReceiptId)}
          onKeyDown={(e) => { if (e.key === 'Enter') toggle(r.handReceiptId) }}
        >
          <span className="p-0.5 text-tertiary shrink-0">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="text-[10pt] text-primary truncate flex-1">{r.recipientLabel}</span>
          <span className="text-[9pt] text-tertiary shrink-0">{formatDate(r.recordedAt)}</span>
        </div>

        {/* Items + actions when expanded */}
        {open && (
          <>
            {r.entries.map((e) => {
              const item = itemsById.get(e.item_id)
              const loc = item?.location_id ? locationNameById.get(item.location_id) : null
              return (
                <div
                  key={e.id}
                  role="button"
                  tabIndex={0}
                  className="group flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer border-l-2 border-l-transparent hover:bg-secondary/5"
                  style={{ paddingLeft: '60px' }}
                  onClick={() => item && onLocateItem(item)}
                  onKeyDown={(e2) => { if (e2.key === 'Enter' && item) onLocateItem(item) }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10pt] text-primary truncate">{item?.name ?? 'Unknown item'}</p>
                    <p className="text-[8pt] text-tertiary mt-0.5 flex items-center gap-1 truncate">
                      {item?.serial_number
                        ? `S/N ${item.serial_number}`
                        : item?.nsn
                          ? `NSN ${item.nsn}`
                          : 'No NSN'}
                      {loc && (
                        <>
                          <span className="text-tertiary/50">·</span>
                          <MapPin size={10} className="text-tertiary shrink-0" />
                          {loc}
                        </>
                      )}
                    </p>
                  </div>
                  {item && (
                    <MapPin size={13} className="text-tertiary opacity-0 group-hover:opacity-100 shrink-0" />
                  )}
                </div>
              )
            })}

            {/* Receipt actions — Print 2062 (+ Sign in while open) */}
            <div className="flex items-center gap-2 py-2" style={{ paddingLeft: '60px' }}>
              <button
                onClick={() => reprint(r)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-themeblue3/10 text-themeblue3 text-[9pt] font-medium active:scale-95 transition-transform"
              >
                <FileText size={13} />
                Print 2062
              </button>
              {!returned && (
                <button
                  onClick={() => setPendingSignIn(r)}
                  disabled={busyId === r.handReceiptId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary/10 text-secondary text-[9pt] font-medium active:scale-95 transition-transform"
                >
                  <RotateCcw size={13} />
                  Sign in
                </button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  const signedOutOpen = expanded.has('__signed_out__')
  const historyOpen = expanded.has('__history__')

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {/* Signed Out — always shown so an empty list reads as "all in". */}
        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer border-l-2 border-l-transparent hover:bg-secondary/5"
          style={{ paddingLeft: '16px' }}
          onClick={() => toggle('__signed_out__')}
          onKeyDown={(e) => { if (e.key === 'Enter') toggle('__signed_out__') }}
        >
          <span className="p-0.5 text-tertiary shrink-0">
            {signedOutOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="text-[10pt] font-medium text-primary truncate flex-1">Signed Out</span>
        </div>
        {signedOutOpen && (
          outstanding.length > 0 ? (
            outstanding.map(renderReceipt)
          ) : (
            <p className="text-[9pt] text-tertiary italic py-1.5" style={{ paddingLeft: '36px' }}>
              {loading ? 'Loading…' : 'Nothing signed out.'}
            </p>
          )
        )}

        {/* History (returned) — hidden when empty. */}
        {history.length > 0 && (
          <>
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer border-l-2 border-l-transparent hover:bg-secondary/5"
              style={{ paddingLeft: '16px' }}
              onClick={() => toggle('__history__')}
              onKeyDown={(e) => { if (e.key === 'Enter') toggle('__history__') }}
            >
              <span className="p-0.5 text-tertiary shrink-0">
                {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="text-[10pt] font-medium text-tertiary truncate flex-1">History</span>
            </div>
            {historyOpen && history.map(renderReceipt)}
          </>
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
        zIndex={1500}
        onConfirm={confirmSignIn}
        onCancel={() => setPendingSignIn(null)}
      />
    </div>
  )
}
