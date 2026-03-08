import { useState, useEffect } from 'react'
import { Clock, Package } from 'lucide-react'
import type { LocalPropertyItem, CustodyLedgerEntry } from '../../Types/PropertyTypes'

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  holderName?: string
  locationName?: string
  getSubItems: (parentId: string) => Promise<LocalPropertyItem[]>
  getLedger: (itemId: string) => Promise<CustodyLedgerEntry[]>
  onSelectSubItem: (item: LocalPropertyItem) => void
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
    <div className="flex flex-col gap-2 px-6 py-2">
      {/* Header */}
      {item.nomenclature && (
        <p className="text-[10pt] text-secondary">{item.nomenclature}</p>
      )}

      {/* Photo */}
      {item.photo_url && (
        <img
          src={item.photo_url}
          alt={item.name}
          className="w-full max-h-48 object-contain rounded-lg bg-secondary/5"
        />
      )}

      {/* Fields */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="NSN" value={item.nsn} />
        <Field label="LIN" value={item.lin} />
        <Field label="Serial #" value={item.serial_number} />
        <Field label="Quantity" value={String(item.quantity ?? 1)} />
        <Field label="Location" value={locationName} />
        <Field label="Holder" value={holderName || 'Unassigned'} />
      </div>

      {item.notes && (
        <div>
          <span className="text-xs font-medium text-tertiary">Notes</span>
          <p className="text-[10pt] text-secondary mt-0.5">{item.notes}</p>
        </div>
      )}

      {/* Sub-items */}
      {subItems.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-1">
            Components ({subItems.length})
          </h3>
          <div className="rounded-lg border border-tertiary/10 overflow-hidden">
            {subItems.map((sub) => (
              <button
                key={sub.id}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/5 border-b border-tertiary/5 last:border-b-0"
                onClick={() => onSelectSubItem(sub)}
              >
                <Package size={16} className="text-tertiary shrink-0" />
                <span className="text-[10pt] text-primary truncate flex-1">{sub.name}</span>
                {sub.quantity > 0 && (
                  <span className="text-[10pt] px-2 py-0.5 rounded-full font-medium shrink-0 bg-themeblue3/10 text-themeblue3">
                    {sub.quantity}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ledger */}
      <div>
        <button
          className="flex items-center gap-2 text-xs font-medium text-tertiary uppercase tracking-wide mb-1"
          onClick={() => setShowLedger(!showLedger)}
        >
          <Clock size={16} />
          Custody History ({ledger.length})
        </button>

        {showLedger && ledger.length > 0 && (
          <div className="space-y-1">
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
