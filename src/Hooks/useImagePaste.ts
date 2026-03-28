import { useEffect } from 'react'

/**
 * Listens for clipboard paste events containing images.
 * Text pastes pass through untouched to normal input handling.
 *
 * Two paths:
 *  1. Synchronous: read image from ClipboardEvent.clipboardData.items (desktop browsers)
 *  2. Async fallback: navigator.clipboard.read() (mobile PWA, iOS Safari, Android Chrome)
 *     — clipboardData.items often arrives empty on mobile even when the clipboard holds an image
 */
export function useImagePaste(enabled: boolean, onImage: (file: File) => void) {
  useEffect(() => {
    if (!enabled) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items

      // ── Synchronous path: clipboardData.items (works on desktop browsers) ──
      if (items?.length) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            e.preventDefault()
            const file = item.getAsFile()
            if (file) onImage(file)
            return
          }
        }
        // clipboardData had items but none were images → text paste, let it through
        return
      }

      // ── Async fallback: Clipboard API (mobile PWA, iOS Safari) ──
      // clipboardData.items was empty/null — common on mobile for image pastes.
      // Try the async Clipboard API which has better mobile support.
      if (navigator.clipboard?.read) {
        navigator.clipboard.read().then(async (clipboardItems) => {
          for (const item of clipboardItems) {
            const imageType = item.types.find((t: string) => t.startsWith('image/'))
            if (imageType) {
              const blob = await item.getType(imageType)
              onImage(new File([blob], 'clipboard.png', { type: imageType }))
              return
            }
          }
        }).catch(() => {
          // Clipboard read denied or unsupported — fall through silently
        })
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [enabled, onImage])
}
