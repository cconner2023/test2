import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { BaseDrawer } from '../BaseDrawer'
import type {
  LocalPropertyItem,
  PropertyCondition,
  TransferPayload,
  TransferChecklistItem,
  HolderInfo,
} from '../../Types/PropertyTypes'

interface CustodyTransferFormProps {
  isVisible: boolean
  onClose: () => void
  item: LocalPropertyItem
  clinicMembers: HolderInfo[]
  currentHolderName: string
  getSubItems: (parentId: string) => Promise<LocalPropertyItem[]>
  onTransfer: (payload: TransferPayload) => Promise<unknown>
}

const CONDITIONS: { value: PropertyCondition; label: string }[] = [
  { value: 'serviceable', label: 'Serviceable' },
  { value: 'unserviceable', label: 'Unserviceable' },
  { value: 'damaged', label: 'Damaged' },
]

export function CustodyTransferForm({
  isVisible,
  onClose,
  item,
  clinicMembers,
  currentHolderName,
  getSubItems,
  onTransfer,
}: CustodyTransferFormProps) {
  const [toHolderId, setToHolderId] = useState('')
  const [conditionCode, setConditionCode] = useState<PropertyCondition>(item.condition_code)
  const [checklist, setChecklist] = useState<TransferChecklistItem[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load sub-items for checklist
  useEffect(() => {
    if (!isVisible) return
    getSubItems(item.id).then((subs) => {
      setChecklist(
        subs.map((s) => ({
          item_id: s.id,
          name: s.name,
          nsn: s.nsn,
          serial_number: s.serial_number,
          present: true, // Default all checked
        })),
      )
    })
  }, [isVisible, item.id, getSubItems])

  const toggleChecklistItem = useCallback((itemId: string) => {
    setChecklist((prev) =>
      prev.map((c) => c.item_id === itemId ? { ...c, present: !c.present } : c),
    )
  }, [])

  const missingCount = checklist.filter((c) => !c.present).length
  const selectedHolder = clinicMembers.find((m) => m.id === toHolderId)

  const handleSubmit = useCallback(async () => {
    if (!toHolderId || !item.current_holder_id) return
    setIsSubmitting(true)

    try {
      const payload: TransferPayload = {
        parent_item_id: item.id,
        from_holder_id: item.current_holder_id,
        to_holder_id: toHolderId,
        condition_code: conditionCode,
        checklist,
        notes: notes.trim() || null,
      }
      await onTransfer(payload)
      onClose()
    } catch {
      // handled by service
    } finally {
      setIsSubmitting(false)
    }
  }, [toHolderId, item, conditionCode, checklist, notes, onTransfer, onClose])

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      fullHeight="85dvh"
      header={{ title: 'Transfer Custody', showBack: true, onBack: onClose }}
    >
      <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto">
        {/* Item being transferred */}
        <div className="p-3 rounded-lg bg-secondary/5">
          <span className="text-xs font-medium text-tertiary">Item</span>
          <p className="text-sm font-medium text-primary">{item.name}</p>
          <span className="text-xs text-secondary">From: {currentHolderName}</span>
        </div>

        {/* Transfer to */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Transfer To</label>
          <select
            className="w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary focus:outline-none focus:border-themeblue3/50 focus:ring-1 focus:ring-themeblue3/20 transition-colors"
            value={toHolderId}
            onChange={(e) => setToHolderId(e.target.value)}
          >
            <option value="">Select recipient...</option>
            {clinicMembers
              .filter((m) => m.id !== item.current_holder_id)
              .map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Condition at Transfer</label>
          <select
            className="w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary focus:outline-none focus:border-themeblue3/50 focus:ring-1 focus:ring-themeblue3/20 transition-colors"
            value={conditionCode}
            onChange={(e) => setConditionCode(e.target.value as PropertyCondition)}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Sub-item checklist */}
        {checklist.length > 0 && (
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

        {/* Missing warning */}
        {missingCount > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {missingCount} item{missingCount > 1 ? 's' : ''} will be logged as discrepancies
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Against: {currentHolderName}
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Notes</label>
          <textarea
            className="w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3/50 resize-none"
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
          {isSubmitting ? 'Transferring...' : 'Complete Transfer'}
        </button>
      </div>
    </BaseDrawer>
  )
}
