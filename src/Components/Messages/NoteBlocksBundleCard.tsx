import { useCallback, useState } from 'react'
import { LayoutTemplate, Plus, Check, RefreshCw, User, Building2 } from 'lucide-react'
import type { SharedBundleContent } from '../../lib/signal/messageContent'
import { unpackBundle } from '../../lib/objectBundle'
import { useNoteBlocksIngest, summarizeIngest, type IngestScope } from '../../Hooks/useNoteBlocksIngest'
import { useLongPress } from '../../Hooks/useLongPress'
import { createLogger } from '../../Utilities/Logger'
import { loadIngested, markIngested } from '../../lib/bundleIngestLog'

const logger = createLogger('NoteBlocksBundleCard')

interface Props {
  content: SharedBundleContent
  isOwn: boolean
  senderName?: string
  messageId: string
  onLongPress?: (x: number, y: number) => void
}

/**
 * Cross/same-cluster note-blocks card. A frozen bundle of text templates / order
 * sets / plan tags arrived in chat; the recipient picks a scope (their personal
 * blocks, or — if supervisor — the clinic's) and Adds, which de-dups against
 * what they already have and merges the rest. No silent write; Add is the gate.
 */
export function NoteBlocksBundleCard({ content, isOwn, senderName, messageId, onLongPress }: Props) {
  const { ingest, canIngestToClinic } = useNoteBlocksIngest()

  const [scope, setScope] = useState<IngestScope>('personal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(() => loadIngested().has(content.contentHash))
  const [summary, setSummary] = useState<string | null>(null)

  const handleAdd = useCallback(async () => {
    if (busy || added) return
    setBusy(true)
    setError(null)
    try {
      const res = await unpackBundle(content.path, content.key, content.contentHash)
      if (!res.ok) { setError('Couldn’t open these blocks.'); return }
      if (res.data.kind !== 'note-blocks') { setError('Unexpected bundle type.'); return }
      const result = ingest(res.data, scope)
      setSummary(summarizeIngest(result))
      markIngested(content.contentHash)
      setAdded(true)
    } catch (e) {
      logger.warn('Note-blocks ingest failed:', e instanceof Error ? e.message : e)
      setError('Couldn’t add these blocks.')
    } finally {
      setBusy(false)
    }
  }, [busy, added, content.path, content.key, content.contentHash, ingest, scope])

  const longPress = useLongPress((x, y) => onLongPress?.(x, y))

  const cardBg = isOwn ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-primary'
  const align = isOwn ? 'justify-end' : 'justify-start'
  const corner = isOwn ? 'rounded-br-md' : 'rounded-bl-md'

  return (
    <div className={`group flex ${align} items-center px-1 mb-1.5`} data-message-id={messageId}>
      <div
        className={`max-w-[260px] w-[260px] p-3 rounded-2xl ${corner} ${cardBg} select-none`}
        style={{ touchAction: 'pan-y' }}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e.clientX, e.clientY) }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onTouchCancel={longPress.onTouchCancel}
      >
        {/* Sender / source-cluster header */}
        <div className="flex items-center gap-1.5 pb-1.5 mb-2 border-b border-current/10">
          <span className={`text-[9pt] font-semibold truncate ${isOwn ? 'text-white/90' : 'text-themeblue2'}`}>
            {senderName || 'Shared'}
          </span>
          <span className={`text-[9pt] truncate ${isOwn ? 'text-white/60' : 'text-tertiary'}`}>
            · from {content.sourceCluster}
          </span>
        </div>

        {/* Title row */}
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/20' : 'bg-themeblue3/10'}`}>
            <LayoutTemplate size={17} className={isOwn ? 'text-white' : 'text-themeblue3'} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-primary'}`}>{content.label}</p>
            {content.subLabel && (
              <p className={`text-[9pt] truncate ${isOwn ? 'text-white/70' : 'text-tertiary'}`}>{content.subLabel}</p>
            )}
          </div>
        </div>

        {/* Scope toggle — only when this receiver can write clinic content. */}
        {!added && canIngestToClinic && (
          <div className={`mt-2.5 grid grid-cols-2 gap-1 p-0.5 rounded-lg ${isOwn ? 'bg-white/15' : 'bg-tertiary/10'}`}>
            {(['personal', 'clinic'] as const).map(s => {
              const active = scope === s
              const Icon = s === 'clinic' ? Building2 : User
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`flex items-center justify-center gap-1.5 h-7 rounded-md text-[10pt] font-medium transition-all active:scale-[0.97]
                             ${active
                               ? (isOwn ? 'bg-white text-themeblue2' : 'bg-themewhite text-primary shadow-sm')
                               : (isOwn ? 'text-white/70' : 'text-tertiary')}`}
                >
                  <Icon size={13} /> {s === 'clinic' ? 'Cluster' : 'Personal'}
                </button>
              )
            })}
          </div>
        )}

        {/* Action */}
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || added}
          className={`mt-2.5 w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium active:scale-[0.98] transition-all
                     ${added
                       ? (isOwn ? 'bg-white/15 text-white/80' : 'bg-themegreen/15 text-themegreen')
                       : (isOwn ? 'bg-white text-themeblue2' : 'bg-themeblue3 text-white')}`}
        >
          {busy ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : added ? (
            <><Check size={15} /> Added</>
          ) : (
            <><Plus size={15} /> Add to my {scope === 'clinic' ? 'cluster' : 'blocks'}</>
          )}
        </button>
        {added && summary && (
          <p className={`mt-1.5 text-[9pt] ${isOwn ? 'text-white/70' : 'text-tertiary'}`}>{summary}</p>
        )}
        {error && <p className={`mt-1.5 text-[9pt] ${isOwn ? 'text-white/80' : 'text-themeredred'}`}>{error}</p>}
      </div>
    </div>
  )
}
