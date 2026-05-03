import { memo, useCallback, useMemo, useState } from 'react'
import { MedevacCard, type MedevacLine } from '../Medevac/MedevacCard'
import { ActionPill } from '../ActionPill'
import { ActionIconButton } from '../WriteNoteHelpers'
import { useTC3Store } from '../../stores/useTC3Store'
import {
  deriveMedevacFromTC3Cards,
  mergeMedevacOverrides,
  patientCategories,
} from '../../Utilities/medevacFromTC3'
import { MEDEVAC_PRECEDENCE_LABELS } from '../../Types/MedevacTypes'
import type { TC3Card } from '../../Types/TC3Types'
import { TC3NineLineEditor } from './TC3NineLineEditor'

interface TC3NineLineProps {
  /** Anchor card — defaults to active store card. Always merged with the casualty queue. */
  card?: TC3Card
  /** Override card list entirely (e.g. bulk export of arbitrary selection). */
  cards?: TC3Card[]
}

const PRECEDENCE_BADGE: Record<string, string> = {
  B: 'bg-themeredred/15 text-themeredred',
  C: 'bg-themeyellow/20 text-themeyellow',
  D: 'bg-themeblue2/10 text-themeblue2',
  E: 'bg-tertiary/15 text-tertiary',
}

function formatProjectionText(req: ReturnType<typeof deriveMedevacFromTC3Cards>): string {
  const lines: string[] = ['9-LINE MEDEVAC', '--------------']
  const l3 = (['A','B','C','D','E'] as const)
    .filter(p => (req.l3[p] ?? 0) > 0)
    .map(p => `${req.l3[p]}${p}`).join(', ') || '0'
  lines.push(`L1 - PICKUP SITE: ${req.l1 || '__________'}${req.l1d ? ` (${req.l1d})` : ''}`)
  lines.push(`L2 - RADIO: ${[req.l2f, req.l2c, req.l2s].filter(Boolean).join(' / ') || '__________'}`)
  lines.push(`L3 - PRECEDENCE: ${l3}`)
  lines.push(`L4 - EQUIPMENT: ${req.l4.join(', ')}`)
  lines.push(`L5 - PATIENT TYPE: ${req.l5l}L / ${req.l5a}A`)
  const wounds = (req.l6wounds ?? []).map(w => w.text).filter(Boolean).join('; ') || 'None documented'
  lines.push(`L6 - WOUNDS: ${wounds}`)
  lines.push(`L7 - MARKING: ${req.l7}${req.l7 === 'C' && req.l7c ? ` (${req.l7c})` : ''}${req.l7 === 'E' && req.l7o ? ` (${req.l7o})` : ''}`)
  const l8 = (['A','B','C','D','E'] as const)
    .filter(n => (req.l8[n] ?? 0) > 0)
    .map(n => `${req.l8[n]}${n}`).join(', ') || '__________'
  lines.push(`L8 - NATIONALITY: ${l8}`)
  lines.push(`L9 - TERRAIN: ${req.l9p || '__________'}`)
  return lines.join('\n')
}

export const TC3NineLine = memo(function TC3NineLine({ card, cards }: TC3NineLineProps) {
  const [copied, setCopied] = useState(false)
  const [editorLine, setEditorLine] = useState<MedevacLine | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const activeCard = useTC3Store(s => s.card)
  const queue = useTC3Store(s => s.casualtyQueue)
  const overrides = useTC3Store(s => s.medevacOverrides)
  const setMedevacOverride = useTC3Store(s => s.setMedevacOverride)
  const pushBlankCasualties = useTC3Store(s => s.pushBlankCasualties)

  const sessionCards = useMemo<TC3Card[]>(() => {
    if (cards && cards.length > 0) return cards
    const anchor = card ?? activeCard
    const queued = queue.map(q => q.card)
    const seen = new Set<string>()
    return [anchor, ...queued].filter(c => {
      if (!c || seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [card, cards, activeCard, queue])

  const derived = useMemo(() => deriveMedevacFromTC3Cards(sessionCards), [sessionCards])
  const projection = useMemo(() => mergeMedevacOverrides(derived, overrides), [derived, overrides])
  const breakdown = useMemo(() => patientCategories(sessionCards), [sessionCards])

  const handleLineClick = useCallback((line: MedevacLine, rect: DOMRect) => {
    setEditorLine(line)
    setAnchorRect(rect)
  }, [])

  const handleClose = useCallback(() => {
    setEditorLine(null)
    setAnchorRect(null)
  }, [])

  const handleL3Grow = useCallback((delta: number) => {
    // L3 grew by delta — top up MASCAL queue with blanks if total now exceeds existing cards.
    const needed = (sessionCards.length + delta) - sessionCards.length
    if (needed > 0) pushBlankCasualties(needed)
  }, [sessionCards.length, pushBlankCasualties])

  if (sessionCards.length === 0) return null

  // Detect L3 < session size for warning
  const l3Total = (['A','B','C','D','E'] as const).reduce((s, p) => s + (projection.l3[p] ?? 0), 0)
  const undercount = l3Total > 0 && l3Total < sessionCards.length

  const handleCopy = async () => {
    const text = formatProjectionText(projection)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">
          9-Line — MASCAL ({sessionCards.length})
        </p>
        <p className="text-[9pt] text-tertiary italic">Tap any row to edit</p>
      </div>

      <MedevacCard data={projection} onLineClick={handleLineClick} />

      {undercount && (
        <p className="mt-2 text-[9pt] text-themeyellow px-3">
          L3 total ({l3Total}) is below MASCAL queue size ({sessionCards.length}). Some casualties aren't represented.
        </p>
      )}

      {/* Per-patient category breakdown — UI-only, not part of clipboard text */}
      <div className="mt-2 px-3 py-2 rounded-xl bg-themewhite2 border border-tertiary/10">
        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-1.5">
          Patient Categories
        </p>
        <div className="flex flex-wrap gap-1.5">
          {breakdown.map(p => (
            <span
              key={p.cardId}
              className={`text-[9pt] px-2 py-0.5 rounded-full font-medium ${
                p.precedence ? PRECEDENCE_BADGE[p.precedence] ?? 'bg-tertiary/10 text-tertiary' : 'bg-tertiary/10 text-tertiary'
              }`}
            >
              {p.displayName}
              {p.precedence
                ? <> — {p.precedence} ({MEDEVAC_PRECEDENCE_LABELS[p.precedence]})</>
                : <> — unassigned</>}
            </span>
          ))}
        </div>
      </div>

      <ActionPill shadow="sm" className="absolute top-2 right-2">
        <ActionIconButton
          onClick={handleCopy}
          status={copied ? 'done' : 'idle'}
          variant="copy"
          title="Copy 9-line text"
        />
      </ActionPill>

      <TC3NineLineEditor
        isOpen={editorLine !== null}
        line={editorLine}
        anchorRect={anchorRect}
        data={projection}
        setOverride={setMedevacOverride}
        onL3GrowDelta={handleL3Grow}
        onClose={handleClose}
      />

    </div>
  )
})
