import { memo, useMemo, useState, useEffect } from 'react'
import { BaseDrawer } from '../BaseDrawer'
import { BarcodeDisplay } from '../Barcode'
import { ActionIconButton } from '../WriteNoteHelpers'
import { useTC3Store } from '../../stores/useTC3Store'
import { useAuthStore, selectIsAuthenticated } from '../../stores/useAuthStore'
import { useAvatar } from '../../Utilities/AvatarContext'
import { getInitials } from '../../Utilities/nameUtils'
import { formatTC3Note } from '../../Utilities/TC3Formatter'
import { formatSignature } from '../../Utilities/NoteFormatter'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'
import { encodeTC3Card } from '../../Utilities/tc3Codec'
import { encryptBarcode } from '../../Utilities/barcodeCodec'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'

/** Injury type → color mapping (matches InjuryMarker) */
const INJURY_COLORS: Record<string, string> = {
  GSW: '#ef4444',
  blast: '#f97316',
  burn: '#eab308',
  laceration: '#3b82f6',
  fracture: '#8b5cf6',
  amputation: '#dc2626',
  other: '#6b7280',
}

interface TC3WriteNoteProps {
  isVisible: boolean
  onClose: () => void
}

export const TC3WriteNote = memo(function TC3WriteNote({ isVisible, onClose }: TC3WriteNoteProps) {
  const card = useTC3Store((s) => s.card)
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const { currentAvatar, customImage, isCustom, isInitials } = useAvatar()

  const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null)
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'shared'>('idle')
  const [encodedText, setEncodedText] = useState('')

  // Format the readable note text
  const noteText = useMemo(() => formatTC3Note(card, profile), [card, profile])

  // Signature line
  const signature = useMemo(() => formatSignature(profile), [profile])

  // Encode the TC3 card to compact barcode string
  const compactString = useMemo(() => encodeTC3Card(card, userId), [card, userId])

  // Encrypt (same pipeline as ADTMC: pack + deflate + AES-GCM + base64)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const encrypted = isAuthenticated ? await encryptBarcode(compactString) : null
      if (cancelled) return
      setEncodedText(encrypted ?? compactString)
    })()
    return () => { cancelled = true }
  }, [compactString, isAuthenticated])

  const handleCopy = async (text: string, target: 'preview' | 'encoded') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedTarget(target)
    setTimeout(() => setCopiedTarget(null), 2000)
  }

  const handleShare = async () => {
    if (!navigator.share) return
    setShareStatus('sharing')
    try {
      await navigator.share({ title: 'TC3 Casualty Card', text: noteText })
      setShareStatus('shared')
    } catch {
      setShareStatus('idle')
      return
    }
    setTimeout(() => setShareStatus('idle'), 2000)
  }

  const hasMarkers = card.markers.length > 0

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      fullHeight="90dvh"
      mobileClassName="flex flex-col bg-themewhite2"
      header={{ title: 'TC3 Card — Export' }}
      contentPadding="standard"
    >
      <div className="space-y-4">
        {/* Medic signature & avatar */}
        {signature && (
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-tertiary/15 bg-themewhite">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
              {isCustom && customImage ? (
                <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
              ) : isInitials ? (
                <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                  <span className="text-sm font-semibold text-themeblue2">
                    {getInitials(profile.firstName, profile.lastName)}
                  </span>
                </div>
              ) : (
                <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full">
                  {currentAvatar.svg}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">
                {[profile.rank, profile.lastName, profile.firstName].filter(Boolean).join(' ')}
              </p>
              <p className="text-[11px] text-tertiary/70 truncate">
                {[profile.credential, profile.component].filter(Boolean).join(' — ')}
              </p>
            </div>
          </div>
        )}

        {/* Body diagram with markers */}
        {hasMarkers && (
          <div className="rounded-xl border border-tertiary/15 bg-themewhite p-3">
            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-2">Injury Diagram</p>
            <TC3BodyDiagramSvg
              markers={card.markers}
              readOnly
              compact
            />
            {/* Marker legend */}
            <div className="mt-2 pt-2 border-t border-tertiary/10 flex flex-wrap gap-x-3 gap-y-1">
              {card.markers.map((m, i) => {
                const region = m.bodyRegion ? getRegionLabel(m.bodyRegion) : `(${Math.round(m.x)}%, ${Math.round(m.y)}%)`
                const label = [
                  ...m.injuries,
                  ...m.procedures,
                ].join(', ') || 'Marker'
                const color = m.injuries.length > 0
                  ? (INJURY_COLORS[m.injuries[0]] ?? '#6b7280')
                  : m.procedures.length > 0
                    ? '#22c55e'
                    : '#f59e0b'
                return (
                  <div key={m.id} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[9px] text-tertiary">
                      {i + 1}. {label} ({region})
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Note Preview */}
        <div>
          <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
            <span className="font-medium">Note Preview</span>
            <ActionIconButton
              onClick={() => handleCopy(noteText, 'preview')}
              status={copiedTarget === 'preview' ? 'done' : 'idle'}
              variant="copy"
              title="Copy note text"
            />
          </div>
          <pre className="p-3 rounded-b-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap max-h-48 overflow-y-auto border border-themegray1/15">
            {noteText || 'No content'}
          </pre>
        </div>

        {/* Encoded Note / Barcode */}
        <div>
          <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
            <span className="font-medium">Encoded Note</span>
            <div className="flex items-center gap-1">
              <ActionIconButton
                onClick={() => handleCopy(encodedText, 'encoded')}
                status={copiedTarget === 'encoded' ? 'done' : 'idle'}
                variant="copy"
                title="Copy encoded text"
              />
              {typeof navigator.share === 'function' && (
                <ActionIconButton
                  onClick={handleShare}
                  status={shareStatus === 'shared' ? 'done' : shareStatus === 'sharing' ? 'busy' : 'idle'}
                  variant="share"
                  title="Share note"
                />
              )}
            </div>
          </div>
          <div className="mt-1">
            {encodedText && <BarcodeDisplay encodedText={encodedText} layout={encodedText.length > 300 ? 'col' : 'row'} />}
          </div>
        </div>
      </div>
    </BaseDrawer>
  )
})
