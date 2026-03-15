import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Pencil, Download } from 'lucide-react'

interface MessageContextMenuProps {
  x: number
  y: number
  isOwn: boolean
  isImage?: boolean
  isVoice?: boolean
  onCopy: () => void
  onEdit: () => void
  onSave?: () => void
  onClose: () => void
}

export function MessageContextMenu({ x, y, isOwn, isImage, isVoice, onCopy, onEdit, onSave, onClose }: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Dismiss on click-away
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Defer listener so the triggering event doesn't immediately dismiss
    const id = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    })

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClose])

  // Clamp position so menu stays within the viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 140),
    top: Math.min(y, window.innerHeight - 100),
    zIndex: 9999,
  }

  return createPortal(
    <div ref={menuRef} style={style}
      className="min-w-[120px] rounded-xl bg-themewhite2 shadow-lg border border-primary/10 py-1"
    >
      {isImage || isVoice ? (
        // Image messages: show Save instead of Copy/Edit
        <>
          {onSave && (
            <button
              onClick={onSave}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
            >
              <Download size={14} className="text-tertiary/60" />
              Save
            </button>
          )}
        </>
      ) : (
        // Text messages: Copy + Edit (if own)
        <>
          <button
            onClick={onCopy}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
          >
            <Copy size={14} className="text-tertiary/60" />
            Copy
          </button>
          {isOwn && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
            >
              <Pencil size={14} className="text-tertiary/60" />
              Edit
            </button>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
