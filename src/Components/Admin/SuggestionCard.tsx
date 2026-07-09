import { Lightbulb } from 'lucide-react'
import type { FeatureVoteSuggestion } from '../../lib/featureVotingService'

export interface SuggestionCardProps {
  suggestion: FeatureVoteSuggestion
  onOpen: (suggestion: FeatureVoteSuggestion) => void
}

/**
 * Feature-suggestion row — icon + title + type + description preview. Tapping
 * opens the suggestion detail in the drawer's detail pane / Sheet.
 */
export function SuggestionCard({ suggestion, onOpen }: SuggestionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(suggestion)}
      className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-themeblue2/5 active:scale-[0.99] transition-all select-none"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeyellow/10">
        <Lightbulb size={16} className="text-themeyellow" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{suggestion.title}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">Feature suggestion</p>
        {suggestion.description && (
          <p className="text-[9pt] text-tertiary mt-0.5 truncate">{suggestion.description}</p>
        )}
      </div>
    </button>
  )
}
