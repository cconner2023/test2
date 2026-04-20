import { Pencil, Trash2, ScanLine } from 'lucide-react'
import { SectionCard } from '../Section'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  locations: LocalPropertyLocation[]
  holders: Map<string, HolderInfo>
  items: LocalPropertyItem[]
  onEdit: () => void
  onDelete: () => void
  onEnroll: () => void
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
      <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase shrink-0">{label}</span>
      <span className="text-[10pt] text-primary text-right truncate">{value}</span>
    </div>
  )
}

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  serviceable: { label: 'Serviceable', color: 'bg-themegreen' },
  unserviceable: { label: 'Unserviceable', color: 'bg-themered' },
  damaged: { label: 'Damaged', color: 'bg-themeyellow' },
  missing: { label: 'Missing', color: 'bg-themeredred' },
}

const EXPIRY_LABELS = {
  expired: { label: 'EXPIRED', dot: 'bg-themeredred', text: 'text-themeredred' },
  expiring: { label: 'EXPIRING SOON', dot: 'bg-themeyellow', text: 'text-themeyellow' },
} as const

export function PropertyItemDetail({ item, locations, holders, items, onEdit, onDelete, onEnroll }: PropertyItemDetailProps) {
  const isMobile = useIsMobile()
  const location = item.location_id ? locations.find(l => l.id === item.location_id) : null
  const holder = item.current_holder_id ? holders.get(item.current_holder_id) : null
  const parentItem = item.parent_item_id ? items.find(i => i.id === item.parent_item_id) : null
  const subItems = items.filter(i => i.parent_item_id === item.id)
  const condition = CONDITION_LABELS[item.condition_code] ?? CONDITION_LABELS.serviceable
  const expiry = expiryStatus(item.expiry_date ?? null)
  const expiryLabel = expiry ? EXPIRY_LABELS[expiry] : null

  return (
    <div className={`flex flex-col h-full ${isMobile ? 'px-4 py-4 space-y-4' : 'px-3 py-3 space-y-3'}`}>
      {/* Main info card */}
      <SectionCard>
        <div className={isMobile ? 'p-4 space-y-1' : 'p-3 space-y-1'}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-2 w-2 rounded-full ${condition.color}`} />
            <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">{condition.label}</span>
          </div>

          <h2 className={`font-bold text-primary ${isMobile ? 'text-lg' : 'text-sm'}`}>{item.name}</h2>

          {item.nomenclature && (
            <p className={`text-secondary ${isMobile ? 'text-sm' : 'text-xs'}`}>{item.nomenclature}</p>
          )}
        </div>
      </SectionCard>

      {/* Details card */}
      <SectionCard>
        <div className={isMobile ? 'px-4 py-2' : 'px-3 py-2'}>
          <DetailRow label="NSN" value={item.nsn} />
          <DetailRow label="LIN" value={item.lin} />
          <DetailRow label="Serial" value={item.serial_number} />
          <DetailRow label="Qty" value={item.quantity > 1 ? String(item.quantity) : null} />
          <DetailRow label="Location" value={location?.name} />
          <DetailRow label="Holder" value={holder?.displayName} />
          <DetailRow label="Parent" value={parentItem?.name} />
          {item.expiry_date && (
            <div className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
              <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase shrink-0">Expires</span>
              <div className="flex items-center gap-1.5">
                {expiryLabel && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${expiryLabel.dot}`} />}
                <span className={`text-[10pt] text-right truncate ${expiryLabel ? expiryLabel.text : 'text-primary'}`}>
                  {item.expiry_date}
                  {expiryLabel && ` · ${expiryLabel.label}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Notes */}
      {item.notes && (
        <SectionCard>
          <div className={isMobile ? 'px-4 py-3' : 'px-3 py-2'}>
            <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Notes</span>
            <p className={`mt-1 text-secondary whitespace-pre-wrap ${isMobile ? 'text-sm' : 'text-xs'}`}>{item.notes}</p>
          </div>
        </SectionCard>
      )}

      {/* Sub-items */}
      {subItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Components</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
              {subItems.length}
            </span>
          </div>
          <SectionCard>
            {subItems.map(sub => (
              <div key={sub.id} className={`flex items-center justify-between ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} border-b border-primary/5 last:border-b-0`}>
                <span className={`text-primary truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{sub.name}</span>
                {sub.serial_number && (
                  <span className="text-[10px] text-tertiary/60 shrink-0 ml-2">{sub.serial_number}</span>
                )}
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* Action buttons */}
      <button
        onClick={onEdit}
        className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-themeblue3/20 bg-themewhite2 font-medium text-themeblue3 active:scale-95 transition-all duration-200 ${
          isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs'
        }`}
      >
        <Pencil className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        Edit Item
      </button>

      <button
        onClick={onEnroll}
        className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-tertiary/20 bg-themewhite2 font-medium text-secondary active:scale-95 transition-all duration-200 ${
          isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs'
        }`}
      >
        <ScanLine className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {item.visual_fingerprint ? 'Update Visual ID' : 'Enroll Visual ID'}
      </button>

      <button
        onClick={onDelete}
        className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-themeredred/20 bg-themewhite2 font-medium text-themeredred active:scale-95 transition-all duration-200 ${
          isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs'
        }`}
      >
        <Trash2 className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        Delete Item
      </button>

      <div className={isMobile ? 'h-16 shrink-0' : 'h-8 shrink-0'} />
    </div>
  )
}
