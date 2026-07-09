import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { HeaderPill } from '@/Components/primitives/HeaderPill'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { adminDeleteSuggestion, type FeatureVoteSuggestion } from '../../lib/featureVotingService'
import { invalidate } from '../../stores/useInvalidationStore'

export interface SuggestionDetailProps {
  suggestion: FeatureVoteSuggestion
  /** Return to the list / close the detail pane after dismiss. */
  onClose: () => void
  /** Publish header actions (ellipsis extras) so the drawer renders them. */
  onHeaderActions?: (node: ReactNode | null) => void
}

/**
 * Feature-suggestion detail — the read-out for a pending suggestion in the
 * admin inbox, rendered in the drawer's detail pane / Sheet. Dismiss lives in
 * the header ellipsis.
 */
export function SuggestionDetail({ suggestion, onClose, onHeaderActions }: SuggestionDetailProps) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDismiss, setConfirmDismiss] = useState(false)

  const handleDismiss = useCallback(async () => {
    setProcessing(true)
    const result = await adminDeleteSuggestion(suggestion.id)
    setProcessing(false)
    if (result.success) {
      setConfirmDismiss(false)
      invalidate('requests')
      onClose()
    } else {
      setError(`Failed to dismiss: ${result.error}`)
    }
  }, [suggestion.id, onClose])

  const headerActions = useMemo(() => {
    const items: ContextMenuItem[] = [
      { key: 'dismiss', label: 'Dismiss', icon: Trash2, destructive: true, onAction: () => setConfirmDismiss(true) },
    ]
    return (
      <HeaderPill>
        <OverlayHeaderMenu items={items} />
      </HeaderPill>
    )
  }, [])

  useEffect(() => {
    onHeaderActions?.(headerActions)
    return () => onHeaderActions?.(null)
  }, [headerActions, onHeaderActions])

  return (
    <>
    <div className={processing ? 'opacity-50 pointer-events-none' : undefined}>
      {error && <div className="pb-3"><ErrorDisplay message={error} /></div>}

      <div className="rounded-2xl bg-themewhite2 px-4 py-3 space-y-2">
        <p className="text-sm font-medium text-primary">{suggestion.title}</p>
        {suggestion.description && (
          <p className="text-[10pt] font-normal text-primary whitespace-pre-wrap">{suggestion.description}</p>
        )}
        <p className="text-[10pt] font-normal text-tertiary">
          Submitted: {new Date(suggestion.createdAt).toLocaleString()}
        </p>
      </div>
    </div>

      <ConfirmDialog
        visible={confirmDismiss}
        title="Dismiss this suggestion?"
        subtitle="Permanent."
        confirmLabel="Dismiss"
        variant="danger"
        processing={processing}
        onConfirm={handleDismiss}
        onCancel={() => setConfirmDismiss(false)}
      />
    </>
  )
}
