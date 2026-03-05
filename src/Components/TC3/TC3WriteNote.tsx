import { memo, useMemo, useState, useEffect } from 'react'
import { Copy, Check, Share2, X } from 'lucide-react'
import { BaseDrawer } from '../BaseDrawer'
import { BarcodeDisplay } from '../Barcode'
import { useTC3Store } from '../../stores/useTC3Store'
import { useAuthStore, selectIsAuthenticated } from '../../stores/useAuthStore'
import { formatTC3Note } from '../../Utilities/TC3Formatter'
import { encodeTC3Card } from '../../Utilities/tc3Codec'
import { encryptBarcode } from '../../Utilities/barcodeCodec'

interface TC3WriteNoteProps {
  isVisible: boolean
  onClose: () => void
}

export const TC3WriteNote = memo(function TC3WriteNote({ isVisible, onClose }: TC3WriteNoteProps) {
  const card = useTC3Store((s) => s.card)
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)

  const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null)
  const [encodedText, setEncodedText] = useState('')

  // Format the readable note text
  const noteText = useMemo(() => formatTC3Note(card, profile), [card, profile])

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
    try {
      await navigator.share({ title: 'TC3 Casualty Card', text: noteText })
    } catch { /* user cancelled */ }
  }

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
            {/* Note Preview */}
            <div>
              <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
                <span className="font-medium">Note Preview</span>
                <button
                  onClick={() => handleCopy(noteText, 'preview')}
                  className="flex items-center gap-1 text-[11px] text-themeblue2 hover:text-themeblue2/80 transition-colors"
                >
                  {copiedTarget === 'preview' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedTarget === 'preview' ? 'Copied' : 'Copy'}</span>
                </button>
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
                  <button
                    onClick={() => handleCopy(encodedText, 'encoded')}
                    className="flex items-center gap-1 text-[11px] text-themeblue2 hover:text-themeblue2/80 transition-colors"
                  >
                    {copiedTarget === 'encoded' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedTarget === 'encoded' ? 'Copied' : 'Copy'}</span>
                  </button>
                  {typeof navigator.share === 'function' && (
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1 text-[11px] text-themeblue2 hover:text-themeblue2/80 transition-colors ml-2"
                    >
                      <Share2 size={12} /> <span>Share</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1">
                {encodedText && <BarcodeDisplay encodedText={encodedText} layout={encodedText.length > 300 ? 'col' : 'row'} />}
              </div>
            </div>
          </div>

          {/* Footer action */}
          <div className="p-4 border-t border-tertiary/10">
            <button
              onClick={() => handleCopy(noteText, 'preview')}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all
                ${copiedTarget === 'preview'
                  ? 'bg-green-500 text-white'
                  : 'bg-themeredred text-white hover:bg-themeredred/90'
                }`}
            >
              {copiedTarget === 'preview' ? <Check size={16} /> : <Copy size={16} />}
              {copiedTarget === 'preview' ? 'Copied to Clipboard' : 'Copy Full Note'}
            </button>
          </div>
        </>
      )}
    </BaseDrawer>
  )
})
