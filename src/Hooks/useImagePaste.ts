import { useEffect } from 'react'

/**
 * Listens for clipboard paste events containing images.
 * Text pastes pass through untouched to normal input handling.
 */
export function useImagePaste(enabled: boolean, onImage: (file: File) => void) {
  useEffect(() => {
    if (!enabled) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) onImage(file)
          return
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [enabled, onImage])
}
