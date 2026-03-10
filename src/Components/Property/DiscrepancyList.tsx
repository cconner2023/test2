import { useState, useCallback } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import type { LocalDiscrepancy, RectifyMethod } from '../../Types/PropertyTypes'

interface DiscrepancyListProps {
  discrepancies: LocalDiscrepancy[]
  onRectify: (id: string, method: string, notes: string) => Promise<unknown>
  itemNames: Map<string, string>
  holderNames: Map<string, string>
}

const RECTIFY_METHODS: { value: RectifyMethod; label: string }[] = [
  { value: 'found', label: 'Found' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'statement_of_charges', label: 'Statement of Charges' },
  { value: 'write_off', label: 'Write Off' },
]

export function DiscrepancyList({ discrepancies, onRectify, itemNames, holderNames }: DiscrepancyListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rectifyMethod, setRectifyMethod] = useState<RectifyMethod>('found')
  const [rectifyNotes, setRectifyNotes] = useState('')
  const [isRectifying, setIsRectifying] = useState(false)

  const open = discrepancies.filter((d) => d.status === 'open')
  const rectified = discrepancies.filter((d) => d.status === 'rectified')

  const handleRectify = useCallback(async (id: string) => {
    setIsRectifying(true)
    try {
      await onRectify(id, rectifyMethod, rectifyNotes)
      setExpandedId(null)
      setRectifyMethod('found')
      setRectifyNotes('')
    } finally {
      setIsRectifying(false)
    }
  }, [onRectify, rectifyMethod, rectifyNotes])

  return (
    <div className="flex flex-col">
      {/* Open discrepancies */}
      {open.length > 0 && (
        <div className="mb-4">
          <h3 className="px-4 text-xs font-medium text-red-600 uppercase tracking-wide mb-2">
            Open ({open.length})
          </h3>
          {open.map((d) => (
            <div key={d.id} className="border-b border-tertiary/10">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/5"
                onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
              >
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-primary block truncate">
                    {itemNames.get(d.item_id) || 'Unknown Item'}
                  </span>
                  <span className="text-xs text-tertiary">
                    Responsible: {holderNames.get(d.responsible_holder_id) || 'Unknown'}
                  </span>
                </div>
                <span className="text-xs text-tertiary">
                  {new Date(d.created_at).toLocaleDateString()}
                </span>
                {expandedId === d.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedId === d.id && (
                <div className="px-4 pb-3 space-y-2">
                  <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary focus:outline-none focus:border-themeblue2"
                    value={rectifyMethod}
                    onChange={(e) => setRectifyMethod(e.target.value as RectifyMethod)}
                  >
                    {RECTIFY_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <textarea
                    className="w-full px-3 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue2 resize-none"
                    rows={2}
                    value={rectifyNotes}
                    onChange={(e) => setRectifyNotes(e.target.value)}
                    placeholder="Resolution notes..."
                  />
                  <button
                    className="w-full py-2 rounded-lg bg-themegreen text-white text-sm font-medium hover:bg-themegreen/90 transition-colors disabled:opacity-50"
                    disabled={isRectifying}
                    onClick={() => handleRectify(d.id)}
                  >
                    {isRectifying ? 'Resolving...' : 'Resolve Discrepancy'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rectified */}
      {rectified.length > 0 && (
        <div>
          <h3 className="px-4 text-xs font-medium text-themegreen uppercase tracking-wide mb-2">
            Resolved ({rectified.length})
          </h3>
          {rectified.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-tertiary/5">
              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-primary truncate block">
                  {itemNames.get(d.item_id) || 'Unknown Item'}
                </span>
                <span className="text-xs text-tertiary">
                  {d.rectify_method?.replace(/_/g, ' ')} — {d.rectified_at ? new Date(d.rectified_at).toLocaleDateString() : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {discrepancies.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title="No discrepancies"
        />
      )}
    </div>
  )
}
