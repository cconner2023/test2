import { useState, useEffect, useCallback } from 'react'
import { ArrowRightLeft, Edit3, Clock, Package, Trash2 } from 'lucide-react'
import type { LocalPropertyItem, CustodyLedgerEntry, LocalDiscrepancy } from '../../Types/PropertyTypes'

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  holderName?: string
  locationName?: string
  onEdit: () => void
  onTransfer: () => void
  onDelete: () => void
  getSubItems: (parentId: string) => Promise<LocalPropertyItem[]>
  getLedger: (itemId: string) => Promise<CustodyLedgerEntry[]>
  onSelectSubItem: (item: LocalPropertyItem) => void
}

const conditionLabel: Record<string, string> = {
  serviceable: 'Serviceable',
  unserviceable: 'Unserviceable',
  damaged: 'Damaged',
  missing: 'Missing',
}

const conditionColor: Record<string, string> = {
  serviceable: 'text-themegreen',
  unserviceable: 'text-themeredred',
  damaged: 'text-themeyellow',
  missing: 'text-themeredred',
}

const actionLabel: Record<string, string> = {
  sign_down: 'Signed Down',
  sign_up: 'Signed Up',
  lateral: 'Lateral Transfer',
  initial_issue: 'Initial Issue',
  turn_in: 'Turned In',
}

export function PropertyItemDetail({
  item,
  holderName,
  locationName,
  onEdit,
  onTransfer,
  onDelete,
  getSubItems,
  getLedger,
  onSelectSubItem,
}: PropertyItemDetailProps) {
  const [subItems, setSubItems] = useState<LocalPropertyItem[]>([])
  const [ledger, setLedger] = useState<CustodyLedgerEntry[]>([])
  const [showLedger, setShowLedger] = useState(false)

  useEffect(() => {
    getSubItems(item.id).then(setSubItems)
    getLedger(item.id).then(setLedger)
  }, [item.id, getSubItems, getLedger])

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-primary">{item.name}</h2>
        </div>
        {item.nomenclature && (
          <p className="text-sm text-secondary">{item.nomenclature}</p>
        )}
      </div>

      {/* Photo */}
      {item.photo_url && (
        <img
          src={item.photo_url}
          alt={item.name}
          className="w-full max-h-48 object-contain rounded-lg bg-secondary/5"
        />
      )}

      {/* Fields */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="NSN" value={item.nsn} />
        <Field label="LIN" value={item.lin} />
        <Field label="Serial #" value={item.serial_number} />
        <Field label="Quantity" value={String(item.quantity ?? 1)} />
        <Field label="Location" value={locationName} />
        <Field label="Condition" value={conditionLabel[item.condition_code]} className={conditionColor[item.condition_code]} />
        <Field label="Holder" value={holderName || 'Unassigned'} />
      </div>

      {item.notes && (
        <div>
          <span className="text-xs font-medium text-tertiary">Notes</span>
          <p className="text-sm text-secondary mt-0.5">{item.notes}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-themeblue3 text-white text-sm font-medium hover:bg-themeblue3/90 transition-colors"
          onClick={onTransfer}
        >
          <ArrowRightLeft size={16} /> Transfer
        </button>
        <button
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-tertiary/20 text-sm font-medium text-primary hover:bg-secondary/5 transition-colors"
          onClick={onEdit}
        >
          <Edit3 size={16} /> Edit
        </button>
        <button
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-themeredred/20 text-sm font-medium text-themeredred hover:bg-themeredred/10 transition-colors"
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Sub-items */}
      {subItems.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-2">
            Components ({subItems.length})
          </h3>
          <div className="rounded-lg border border-tertiary/10 overflow-hidden">
            {subItems.map((sub) => (
              <button
                key={sub.id}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/5 border-b border-tertiary/5 last:border-b-0"
                onClick={() => onSelectSubItem(sub)}
              >
                <Package size={14} className="text-tertiary shrink-0" />
                <span className="text-sm text-primary truncate flex-1">{sub.name}</span>
                <span className={`text-[10px] font-medium ${conditionColor[sub.condition_code]}`}>
                  {conditionLabel[sub.condition_code]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ledger */}
      <div>
        <button
          className="flex items-center gap-2 text-xs font-medium text-tertiary uppercase tracking-wide mb-2"
          onClick={() => setShowLedger(!showLedger)}
        >
          <Clock size={12} />
          Custody History ({ledger.length})
        </button>

        {showLedger && ledger.length > 0 && (
          <div className="space-y-2">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs p-2 rounded bg-secondary/5">
                <div className="w-1.5 h-1.5 rounded-full bg-themeblue3 mt-1.5 shrink-0" />
                <div>
                  <span className="font-medium text-primary">{actionLabel[entry.action] || entry.action}</span>
                  <span className="text-tertiary ml-1">
                    {new Date(entry.recorded_at).toLocaleDateString()}
                  </span>
                  {entry.notes && <p className="text-secondary mt-0.5">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-tertiary">{label}</span>
      <p className={`text-sm mt-0.5 ${className || 'text-primary'}`}>{value || '\u2014'}</p>
    </div>
  )
}
