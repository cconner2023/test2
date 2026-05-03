import { useCallback, useRef, useState } from 'react'
import { Lightbulb, Trash2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import type { FeatureVoteSuggestion } from '../../lib/featureVotingService'

export interface SuggestionCardProps {
  suggestion: FeatureVoteSuggestion
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  setConfirmDeleteId: (id: string | null) => void
}

export function SuggestionCard({
  suggestion,
  expandedId,
  setExpandedId,
  setConfirmDeleteId,
}: SuggestionCardProps) {
  const isExpanded = expandedId === suggestion.id
  const cardRef = useRef<HTMLDivElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const handleTap = useCallback(() => {
    setAnchorRect(cardRef.current?.getBoundingClientRect() ?? null)
    setExpandedId(isExpanded ? null : suggestion.id)
  }, [isExpanded, setExpandedId, suggestion.id])

  const handleClose = useCallback(() => setExpandedId(null), [setExpandedId])

  return (
    <>
      <div
        ref={cardRef}
        onClick={handleTap}
        className="transition-all hover:bg-themeblue2/5 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeyellow/10">
            <Lightbulb size={16} className="text-themeyellow" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{suggestion.title}</p>
            <p className="text-[9pt] text-tertiary mt-0.5 truncate">Feature suggestion</p>
          </div>
          <span className="text-[9pt] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 bg-themeyellow/10 text-themeyellow border-themeyellow/30">
            Idea
          </span>
        </div>

        {suggestion.description && (
          <p className="text-[10pt] font-normal text-tertiary px-4 pb-2 line-clamp-2">{suggestion.description}</p>
        )}
      </div>

      <PreviewOverlay
        isOpen={isExpanded}
        onClose={handleClose}
        anchorRect={anchorRect}
        title="Feature suggestion"
        maxWidth={420}
        previewMaxHeight="65dvh"
        footer={
          <ActionPill>
            <ActionButton
              icon={Trash2}
              label="Dismiss"
              variant="danger"
              onClick={() => setConfirmDeleteId(suggestion.id)}
            />
          </ActionPill>
        }
      >
        <div className="px-4 py-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {suggestion.description && (
            <p className="text-[10pt] font-normal text-primary whitespace-pre-wrap">{suggestion.description}</p>
          )}
          <p className="text-[10pt] font-normal text-tertiary">
            Submitted: {new Date(suggestion.createdAt).toLocaleString()}
          </p>
        </div>
      </PreviewOverlay>
    </>
  )
}
