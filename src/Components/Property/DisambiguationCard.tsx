import type { LocalPropertyItem } from '../../Types/PropertyTypes'

interface DisambiguationCardProps {
  candidates: Array<{
    itemId: string
    score: number
    matchedBarcode?: string
  }>
  items: LocalPropertyItem[]
  onSelect: (itemId: string) => void
  onManual: () => void
}

function confidenceColor(score: number): string {
  if (score >= 0.85) return 'text-themegreen'
  if (score >= 0.60) return 'text-amber-400'
  return 'text-themeredred'
}

export function DisambiguationCard({ candidates, items, onSelect, onManual }: DisambiguationCardProps) {
  const resolved = candidates.slice(0, 3).map(c => {
    const item = items.find(i => i.id === c.itemId)
    return { candidate: c, item }
  })

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-xs font-semibold text-secondary tracking-wider uppercase px-1 mb-1">
        Multiple matches found
      </p>

      {resolved.map(({ candidate, item }) => (
        <button
          key={candidate.itemId}
          onClick={() => onSelect(candidate.itemId)}
          className="w-full text-left bg-themewhite border border-tertiary/20 rounded-2xl px-4 py-3 shadow-lg active:scale-[0.98] transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-primary truncate">
                {item?.name ?? 'Unknown Item'}
              </p>

              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {item?.nsn && (
                  <span className="text-[9pt] text-tertiary font-medium">
                    NSN {item.nsn}
                  </span>
                )}
                {(item?.quantity ?? 1) > 1 && (
                  <span className="text-[9pt] bg-themewhite2 border border-tertiary/20 rounded-full px-2 py-0.5 text-secondary font-semibold">
                    ×{item!.quantity}
                  </span>
                )}
                {candidate.matchedBarcode && (
                  <span className="text-[9pt] bg-themeblue2/10 text-themeblue2 border border-themeblue2/20 rounded-full px-2 py-0.5 font-semibold">
                    barcode
                  </span>
                )}
              </div>
            </div>

            <span className={`text-sm font-bold shrink-0 ${confidenceColor(candidate.score)}`}>
              {Math.round(candidate.score * 100)}%
            </span>
          </div>
        </button>
      ))}

      <button
        onClick={onManual}
        className="w-full mt-1 py-3 rounded-full text-sm text-secondary font-medium active:scale-95 transition-all"
      >
        None of these
      </button>
    </div>
  )
}
