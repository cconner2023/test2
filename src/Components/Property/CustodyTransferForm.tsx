import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import type {
  LocalPropertyItem,
  TransferPayload,
  TransferChecklistItem,
  HolderInfo,
} from '../../Types/PropertyTypes'

interface CustodyTransferFormProps {
  items: LocalPropertyItem[]
  clinicMembers: HolderInfo[]
  holders: Map<string, HolderInfo>
  getSubItems: (parentId: string) => Promise<LocalPropertyItem[]>
  onTransfer: (payload: TransferPayload) => Promise<unknown>
  onBack: () => void
}

const UNIT_OF_ISSUE_OPTIONS = [
  'EA', 'BX', 'SE', 'KT', 'PR', 'PG', 'DZ', 'RO', 'HD',
]

export function CustodyTransferForm({
  items,
  clinicMembers,
  holders,
  getSubItems,
  onTransfer,
  onBack,
}: CustodyTransferFormProps) {
  const isBatch = items.length > 1
  const singleItem = !isBatch ? items[0] : null

  const [toHolderId, setToHolderId] = useState('')
  const [quantity, setQuantity] = useState(singleItem?.quantity ?? 1)
  const [unitOfIssue, setUnitOfIssue] = useState('EA')
  const [checklist, setChecklist] = useState<TransferChecklistItem[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load sub-items for checklist (single item only)
  useEffect(() => {
    if (isBatch || !singleItem) return
    getSubItems(singleItem.id).then((subs) => {
      setChecklist(
        subs.map((s) => ({
          item_id: s.id,
          name: s.name,
          nsn: s.nsn,
          serial_number: s.serial_number,
          present: true,
        })),
      )
    })
  }, [isBatch, singleItem?.id, getSubItems])

  const toggleChecklistItem = useCallback((itemId: string) => {
    setChecklist((prev) =>
      prev.map((c) => c.item_id === itemId ? { ...c, present: !c.present } : c),
    )
  }, [])

  const missingCount = checklist.filter((c) => !c.present).length
  const maxQuantity = singleItem?.quantity ?? 1

  // Collect unique current holders across all selected items
  const fromHolderIds = new Set(items.map((i) => i.current_holder_id).filter(Boolean) as string[])

  const handleSubmit = useCallback(async () => {
    if (!toHolderId) return
    setIsSubmitting(true)

    try {
      if (isBatch) {
        // Batch transfer — one call per item
        for (const item of items) {
          if (!item.current_holder_id) continue
          const payload: TransferPayload = {
            parent_item_id: item.id,
            from_holder_id: item.current_holder_id,
            to_holder_id: toHolderId,
            condition_code: item.condition_code,
            quantity: item.quantity ?? 1,
            unitOfIssue: 'EA',
            checklist: [],
            notes: notes.trim() || null,
          }
          await onTransfer(payload)
        }
      } else if (singleItem?.current_holder_id) {
        // Single transfer
        const payload: TransferPayload = {
          parent_item_id: singleItem.id,
          from_holder_id: singleItem.current_holder_id,
          to_holder_id: toHolderId,
          condition_code: singleItem.condition_code,
          quantity,
          unitOfIssue,
          checklist,
          notes: notes.trim() || null,
        }
        await onTransfer(payload)
      }
      onBack()
    } catch {
      // handled by service
    } finally {
      setIsSubmitting(false)
    }
  }, [toHolderId, items, isBatch, singleItem, quantity, unitOfIssue, checklist, notes, onTransfer, onBack])

  return (
    <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto">
      {/* Items being transferred */}
      <div className="p-3 rounded-lg bg-secondary/5">
        <span className="text-xs font-medium text-tertiary">
          {isBatch ? `${items.length} Items` : 'Item'}
        </span>
        {isBatch ? (
          <div className="mt-1 space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm text-primary truncate">{item.name}</span>
                <span className="text-xs text-tertiary shrink-0 ml-2">
                  {item.current_holder_id ? holders.get(item.current_holder_id)?.displayName ?? 'Unknown' : 'Unassigned'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-primary">{singleItem?.name}</p>
            <span className="text-xs text-secondary">
              From: {singleItem?.current_holder_id ? holders.get(singleItem.current_holder_id)?.displayName ?? 'Unknown' : 'Unassigned'}
            </span>
          </>
        )}
      </div>

      {/* Transfer to */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1">Transfer To</label>
        <select
          className="w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary focus:outline-none focus:border-themeblue2 transition-colors"
          value={toHolderId}
          onChange={(e) => setToHolderId(e.target.value)}
        >
          <option value="">Select recipient...</option>
          {clinicMembers
            .filter((m) => !fromHolderIds.has(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
        </select>
      </div>

      {/* Quantity + Unit of Issue — single item only */}
      {!isBatch && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-secondary mb-1">
              Quantity {maxQuantity > 1 && <span className="text-tertiary">(max {maxQuantity})</span>}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(e) => {
                const v = Math.max(1, Math.min(maxQuantity, Number(e.target.value) || 1))
                setQuantity(v)
              }}
              className="w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary focus:outline-none focus:border-themeblue2 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-secondary mb-1">Unit of Issue</label>
            <select
              className="w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary focus:outline-none focus:border-themeblue2 transition-colors"
              value={unitOfIssue}
              onChange={(e) => setUnitOfIssue(e.target.value)}
            >
              {UNIT_OF_ISSUE_OPTIONS.map((ui) => (
                <option key={ui} value={ui}>{ui}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Sub-item checklist — single item only */}
      {!isBatch && checklist.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-secondary mb-2">
            Component Inventory Check ({checklist.length} items)
          </label>
          <div className="rounded-lg border border-tertiary/10 overflow-hidden">
            {checklist.map((c) => (
              <label
                key={c.item_id}
                className="flex items-center gap-3 px-3 py-2 border-b border-tertiary/5 last:border-b-0 cursor-pointer hover:bg-secondary/5"
              >
                <input
                  type="checkbox"
                  checked={c.present}
                  onChange={() => toggleChecklistItem(c.item_id)}
                  className="rounded border-tertiary/30 text-themeblue3 focus:ring-themeblue3/20"
                />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${c.present ? 'text-primary' : 'text-red-500 line-through'}`}>
                    {c.name}
                  </span>
                  {c.nsn && <span className="text-xs text-tertiary ml-2">{c.nsn}</span>}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Missing warning — single item only */}
      {!isBatch && missingCount > 0 && singleItem && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-themeyellow/10 border border-themeyellow/30">
          <AlertTriangle size={16} className="text-themeyellow shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-themeyellow">
              {missingCount} item{missingCount > 1 ? 's' : ''} will be logged as discrepancies
            </p>
            <p className="text-xs text-themeyellow mt-0.5">
              Against: {singleItem.current_holder_id ? holders.get(singleItem.current_holder_id)?.displayName ?? 'Unknown' : 'Unassigned'}
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1">Notes</label>
        <textarea
          className="w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue2 resize-none"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Transfer notes..."
        />
      </div>

      {/* Submit */}
      <button
        className="w-full py-3 rounded-lg bg-themeblue3 text-white text-sm font-medium hover:bg-themeblue3/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!toHolderId || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting
          ? 'Transferring...'
          : isBatch
            ? `Transfer ${items.length} Items`
            : 'Complete Transfer'}
      </button>
    </div>
  )
}
