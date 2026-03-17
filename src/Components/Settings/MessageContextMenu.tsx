import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Pencil, Download, Reply, Trash2, Forward } from 'lucide-react'

interface MessageContextMenuProps {
  x: number
  y: number
  isOwn: boolean
  isImage?: boolean
  isVoice?: boolean
  onReply: () => void
  onCopy: () => void
  onEdit: () => void
  onForward: () => void
  onDelete: () => void
  onSave?: () => void
  onClose: () => void
}

export function MessageContextMenu({ x, y, isOwn, isImage, isVoice, onReply, onCopy, onEdit, onForward, onDelete, onSave, onClose }: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

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

  // Count visible items to estimate menu height for clamping
  const isMedia = isImage || isVoice
  let itemCount = 1 // Reply is always shown
  if (!isMedia) itemCount++ // Copy
  if (isMedia && onSave) itemCount++ // Save
  if (isOwn && !isMedia) itemCount++ // Edit
  itemCount++ // Forward
  if (isOwn) itemCount++ // Delete
  const estimatedHeight = itemCount * 40 + 8 // 40px per item + padding

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 160),
    top: Math.min(y, window.innerHeight - estimatedHeight),
    zIndex: 9999,
  }

  const itemClass = "flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"

  return createPortal(
    <div ref={menuRef} style={style}
      className="min-w-[140px] rounded-xl bg-themewhite2 shadow-lg border border-primary/10 py-1"
    >
      <button onClick={onReply} className={itemClass}>
        <Reply size={14} className="text-tertiary/60" />
        Reply
      </button>

      {isMedia ? (
        onSave && (
          <button onClick={onSave} className={itemClass}>
            <Download size={14} className="text-tertiary/60" />
            Save
          </button>
        )
      ) : (
        <>
          <button onClick={onCopy} className={itemClass}>
            <Copy size={14} className="text-tertiary/60" />
            Copy
          </button>
          {isOwn && (
            <button onClick={onEdit} className={itemClass}>
              <Pencil size={14} className="text-tertiary/60" />
              Edit
            </button>
          )}
        </>
      )}

      <button onClick={onForward} className={itemClass}>
        <Forward size={14} className="text-tertiary/60" />
        Forward
      </button>

      {isOwn && (
        <>
          <div className="mx-2.5 my-1 border-t border-primary/8" />
          <button onClick={onDelete} className={itemClass.replace('text-primary', 'text-red-400')}>
            <Trash2 size={14} className="text-red-400" />
            Delete
          </button>
        </>
      )}
    </div>,
    document.body,
  )
}
