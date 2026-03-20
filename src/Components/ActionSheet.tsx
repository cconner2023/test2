import { useEffect, useState, useCallback, useRef } from 'react'
import { useIsMobile } from '../Hooks/useIsMobile'

export interface ActionSheetOption {
  key: string
  label: string
  onAction: () => void
}

interface ActionSheetProps {
  visible: boolean
  title: string
  options: ActionSheetOption[]
  onClose: () => void
}

export function ActionSheet({ visible, title, options, onClose }: ActionSheetProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
    } else {
      setOpen(false)
      const t = setTimeout(() => {
        setMounted(false)
        setDragY(0)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [visible])

  const handleClose = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-drag-zone]')) return
    dragStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const dy = Math.max(0, e.touches[0].clientY - dragStartY.current)
    setDragY(dy)
  }, [isDragging])

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragY > 80) {
      handleClose()
    }
    setDragY(0)
  }, [isDragging, dragY, handleClose])

  if (!mounted) return null

  const handleOption = (option: ActionSheetOption) => {
    handleClose()
    setTimeout(option.onAction, 320)
  }

  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
          style={{ pointerEvents: open ? 'auto' : 'none' }}
          onClick={handleClose}
        />
        <div
          className={`fixed left-0 right-0 bottom-0 z-50 bg-themewhite3 rounded-t-[1.25rem] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{
            transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
            maxHeight: '40dvh',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-sheet-title"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="w-9 h-1 rounded-full bg-tertiary/25" />
          </div>

          <div className="px-5 pb-5 flex flex-col">
            <h2 id="action-sheet-title" className="text-lg font-medium text-primary mb-4">
              {title}
            </h2>

            <div className="flex flex-col gap-2.5">
              {options.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleOption(opt)}
                  className="w-full py-3 rounded-full text-[15px] font-medium text-themeblue3 border border-themeblue3/40 active:scale-95 transition-all"
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={handleClose}
                className="w-full py-3 rounded-full text-[15px] font-medium text-tertiary active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  /* Desktop: centered modal */
  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-20' : 'opacity-0'}`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className={`bg-themewhite rounded-3xl shadow-xl px-8 py-8 max-w-[340px] w-full pointer-events-auto transition-all duration-300 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-sheet-title"
        >
          <p id="action-sheet-title" className="text-lg font-medium text-primary text-center mb-6">
            {title}
          </p>

          <div className="flex flex-col gap-3 max-w-[260px] mx-auto">
            {options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleOption(opt)}
                className="w-full py-3 rounded-full text-[15px] font-medium text-themeblue3 border border-themeblue3/40 active:scale-95 transition-all"
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-full text-[15px] font-medium text-tertiary active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
