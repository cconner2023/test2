import { useState, useMemo } from 'react'
import { ScanLine, ArrowRightLeft, GitMerge, Plus, Minus, Check, X } from 'lucide-react'
import { SectionCard } from '../Section'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  locations: LocalPropertyLocation[]
  holders: Map<string, HolderInfo>
  items: LocalPropertyItem[]
  onEnroll: () => void
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
      <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase shrink-0">{label}</span>
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

export function PropertyItemDetail({ item, locations, holders, items, onEnroll }: PropertyItemDetailProps) {
  const isMobile = useIsMobile()
  const splitItem = usePropertyStore(s => s.splitItem)
  const mergeItems = usePropertyStore(s => s.mergeItems)

  const [showSplitSheet, setShowSplitSheet] = useState(false)
  const [showMergeSheet, setShowMergeSheet] = useState(false)
  const [splitQty, setSplitQty] = useState(1)
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null)

  const mergeCandidates = useMemo(() =>
    items.filter(i =>
      i.id !== item.id &&
      !i.is_serialized &&
      i.name.toLowerCase() === item.name.toLowerCase()
    ),
    [items, item.id, item.name]
  )

  const splitMergeTarget = useMemo(() =>
    splitTargetId
      ? items.find(i =>
          i.id !== item.id &&
          !i.is_serialized &&
          i.location_id === splitTargetId &&
          i.name.toLowerCase() === item.name.toLowerCase() &&
          (item.nsn ? i.nsn === item.nsn : !i.nsn)
        ) ?? null
      : null,
    [splitTargetId, items, item.id, item.name, item.nsn]
  )

  const handleSplit = async () => {
    if (!splitTargetId) return
    setShowSplitSheet(false)
    await splitItem(item.id, splitQty, splitTargetId)
  }

  const handleMerge = async (sourceId: string) => {
    setShowMergeSheet(false)
    await mergeItems(sourceId, item.id)
  }

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
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">{condition.label}</span>
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
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase shrink-0">Expires</span>
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
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Notes</span>
            <p className={`mt-1 text-secondary whitespace-pre-wrap ${isMobile ? 'text-sm' : 'text-xs'}`}>{item.notes}</p>
          </div>
        </SectionCard>
      )}

      {/* Sub-items */}
      {subItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Components</span>
            <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
              {subItems.length}
            </span>
          </div>
          <SectionCard>
            {subItems.map(sub => (
              <div key={sub.id} className={`flex items-center justify-between ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} border-b border-primary/5 last:border-b-0`}>
                <span className={`text-primary truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{sub.name}</span>
                {sub.serial_number && (
                  <span className="text-[9pt] text-tertiary shrink-0 ml-2">{sub.serial_number}</span>
                )}
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* Action buttons */}
      <button
        onClick={onEnroll}
        className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-tertiary/20 bg-themewhite2 font-medium text-secondary active:scale-95 transition-all duration-200 ${
          isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs'
        }`}
      >
        <ScanLine className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {item.visual_fingerprint ? 'Update Visual ID' : 'Enroll Visual ID'}
      </button>

      {!item.is_serialized && (
        <button
          onClick={() => { setSplitQty(1); setSplitTargetId(null); setShowSplitSheet(true) }}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-tertiary/20 bg-themewhite2 font-medium text-secondary active:scale-95 transition-all duration-200 ${
            isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs'
          }`}
        >
          <ArrowRightLeft className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          {item.quantity > 1 ? 'Split / Move' : 'Move to Location'}
        </button>
      )}

      {!item.is_serialized && mergeCandidates.length > 0 && (
        <button
          onClick={() => setShowMergeSheet(true)}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-tertiary/20 bg-themewhite2 font-medium text-secondary active:scale-95 transition-all duration-200 ${
            isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs'
          }`}
        >
          <GitMerge className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          Merge Like Items
        </button>
      )}

      <div className={isMobile ? 'h-16 shrink-0' : 'h-8 shrink-0'} />

      {/* Split / Move sheet */}
      {showSplitSheet && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowSplitSheet(false)} />
          <div className="fixed left-0 right-0 bottom-0 z-[60] bg-themewhite3 rounded-t-[1.25rem] flex flex-col gap-4 p-5" style={{ maxHeight: '75dvh' }}>
            <div className="w-9 h-1 rounded-full bg-tertiary/25 self-center shrink-0" />
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-medium text-primary">
                {item.quantity > 1 ? 'Split / Move' : 'Move to Location'}
              </h2>
              <button onClick={() => setShowSplitSheet(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95">
                <X size={18} />
              </button>
            </div>

            {item.quantity > 1 && (
              <div className="shrink-0">
                <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">Quantity to move</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSplitQty(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full border border-tertiary/20 flex items-center justify-center text-secondary active:scale-95 transition-all"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-2xl font-semibold text-primary w-12 text-center">{splitQty}</span>
                  <button
                    onClick={() => setSplitQty(q => Math.min(item.quantity, q + 1))}
                    className="w-10 h-10 rounded-full border border-tertiary/20 flex items-center justify-center text-secondary active:scale-95 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                  <span className="text-xs text-tertiary">of {item.quantity}</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">Destination</p>
              <SectionCard>
                {locations
                  .filter(l => l.id !== item.location_id)
                  .map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => setSplitTargetId(loc.id === splitTargetId ? null : loc.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-primary/5 last:border-b-0 transition-colors ${
                        splitTargetId === loc.id ? 'bg-themeblue3/10' : 'active:bg-secondary/5'
                      }`}
                    >
                      <span className="text-sm text-primary">{loc.name}</span>
                      {splitTargetId === loc.id && <Check size={16} className="text-themeblue3 shrink-0" />}
                    </button>
                  ))
                }
                {locations.filter(l => l.id !== item.location_id).length === 0 && (
                  <p className="text-sm text-tertiary px-4 py-3">No other locations</p>
                )}
              </SectionCard>
            </div>

            {splitMergeTarget && (
              <p className="text-xs text-secondary shrink-0">
                Will merge into existing <span className="font-medium">{splitMergeTarget.name}</span> (×{splitMergeTarget.quantity}) at that location
              </p>
            )}

            <button
              onClick={handleSplit}
              disabled={!splitTargetId}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-themeblue3 text-white font-medium py-3 text-sm disabled:opacity-30 active:scale-[0.98] transition-all duration-200 shrink-0"
            >
              <ArrowRightLeft size={16} />
              {splitQty >= item.quantity ? 'Move All' : `Move ${splitQty}`}
            </button>
          </div>
        </>
      )}

      {/* Merge sheet */}
      {showMergeSheet && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowMergeSheet(false)} />
          <div className="fixed left-0 right-0 bottom-0 z-[60] bg-themewhite3 rounded-t-[1.25rem] flex flex-col gap-4 p-5" style={{ maxHeight: '60dvh' }}>
            <div className="w-9 h-1 rounded-full bg-tertiary/25 self-center shrink-0" />
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-medium text-primary">Merge Like Items</h2>
              <button onClick={() => setShowMergeSheet(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-secondary shrink-0">
              Select an item to absorb into <span className="font-medium">{item.name}</span> (×{item.quantity}). The selected item will be deleted.
            </p>
            <div className="flex-1 overflow-y-auto min-h-0">
              <SectionCard>
                {mergeCandidates.map(candidate => {
                  const candidateLoc = candidate.location_id ? locations.find(l => l.id === candidate.location_id) : null
                  return (
                    <button
                      key={candidate.id}
                      onClick={() => handleMerge(candidate.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-primary/5 last:border-b-0 active:bg-secondary/5 transition-colors"
                    >
                      <div>
                        <p className="text-sm text-primary">{candidate.name}</p>
                        {candidateLoc && <p className="text-xs text-tertiary">{candidateLoc.name}</p>}
                      </div>
                      <span className="text-sm font-medium px-2 py-1 rounded-full bg-tertiary/10 text-tertiary shrink-0 ml-2">
                        ×{candidate.quantity}
                      </span>
                    </button>
                  )
                })}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
