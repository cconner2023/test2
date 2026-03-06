import { memo, useMemo, useState, useEffect } from 'react'
import { X } from 'lucide-react'
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
import type { TC3Injury, BodySide } from '../../Types/TC3Types'

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

/** Read-only body outline with injury markers for the export view */
function ExportBodyPanel({ side, injuries }: { side: BodySide; injuries: TC3Injury[] }) {
  const sideInjuries = injuries.filter(inj => inj.side === side)

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[8px] font-semibold text-tertiary/40 tracking-widest uppercase text-center mb-0.5">
        {side === 'front' ? 'Front' : 'Back'}
      </p>
      <div
        className="relative text-tertiary/25 mx-auto"
        style={{ maxWidth: '100px', aspectRatio: '200/400' }}
      >
        <svg viewBox="0 0 200 400" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Head */}
          <ellipse cx="100" cy="35" rx="22" ry="28" />
          {/* Neck */}
          <line x1="92" y1="62" x2="92" y2="75" />
          <line x1="108" y1="62" x2="108" y2="75" />
          {/* Torso */}
          {side === 'front' ? (
            <path d="M70 75 L60 85 L55 140 L60 200 L75 210 L80 200 L100 205 L120 200 L125 210 L140 200 L145 140 L140 85 L130 75 Z" />
          ) : (
            <>
              <path d="M70 75 L60 85 L55 140 L58 200 L75 215 L100 210 L125 215 L142 200 L145 140 L140 85 L130 75 Z" />
              <line x1="100" y1="75" x2="100" y2="200" strokeDasharray="4 3" opacity="0.4" />
              <path d="M75 215 Q100 225 125 215" strokeDasharray="3 3" opacity="0.3" />
            </>
          )}
          {/* Left arm */}
          <path d="M60 85 L40 120 L30 170 L25 200 L30 205 L38 200 L45 170 L55 140" />
          {/* Right arm */}
          <path d="M140 85 L160 120 L170 170 L175 200 L170 205 L162 200 L155 170 L145 140" />
          {/* Left leg */}
          {side === 'front' ? (
            <path d="M75 210 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 205" />
          ) : (
            <path d="M75 215 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 210" />
          )}
          {/* Right leg */}
          {side === 'front' ? (
            <path d="M125 210 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 205" />
          ) : (
            <path d="M125 215 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 210" />
          )}
        </svg>
        {/* Injury dots */}
        {sideInjuries.map(inj => (
          <div
            key={inj.id}
            className="absolute w-3.5 h-3.5 rounded-full border border-white shadow-sm flex items-center justify-center text-[5px] font-bold text-white"
            style={{
              left: `${inj.x}%`,
              top: `${inj.y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: INJURY_COLORS[inj.type] ?? '#6b7280',
            }}
            title={`${inj.type} — ${inj.bodyRegion ? getRegionLabel(inj.bodyRegion) : inj.side}`}
          >
            {inj.type.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  )
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

  const hasInjuries = card.injuries.length > 0

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      fullHeight="90dvh"
      mobileClassName="flex flex-col bg-themewhite2"
    >
      {(handleClose) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-tertiary/10" data-drag-zone style={{ touchAction: 'none' }}>
            <h2 className="text-sm font-semibold text-primary">TC3 Card — Export</h2>
            <div className="flex items-center gap-2">
              <div className="w-14 h-1.5 rounded-full bg-tertiary/30 md:hidden" />
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all">
                <X size={20} className="text-tertiary" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

            {/* Body diagram with injuries */}
            {hasInjuries && (
              <div className="rounded-xl border border-tertiary/15 bg-themewhite p-3">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-2">Injury Diagram</p>
                <div className="flex gap-2 justify-center">
                  <ExportBodyPanel side="front" injuries={card.injuries} />
                  <ExportBodyPanel side="back" injuries={card.injuries} />
                </div>
                {/* Injury legend */}
                <div className="mt-2 pt-2 border-t border-tertiary/10 flex flex-wrap gap-x-3 gap-y-1">
                  {card.injuries.map((inj, i) => {
                    const region = inj.bodyRegion ? getRegionLabel(inj.bodyRegion) : inj.side
                    return (
                      <div key={inj.id} className="flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: INJURY_COLORS[inj.type] ?? '#6b7280' }}
                        />
                        <span className="text-[9px] text-tertiary">
                          {i + 1}. {inj.type} ({region})
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
        </>
      )}
    </BaseDrawer>
  )
})
