import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, RefObject } from 'react'

interface BaseOverlayProps {
  isOpen: boolean
  onClose: () => void
  /** 'subtle' = solid dim rgba(0,0,0,0.4) (Popover). 'blur' = heavy blur + dim (ContextMenuPreview). */
  backdrop: 'subtle' | 'blur'
  zIndex?: number
  /** When provided, portals into this element (absolute positioning) instead of document.body (fixed). */
  containerRef?: RefObject<HTMLElement | null>
  /** Render prop — receives current visible state for driving enter/exit animations. */
  children: (visible: boolean) => ReactNode
}

export function BaseOverlay({
  isOpen,
  onClose,
  backdrop,
  zIndex = 60,
  containerRef,
  children,
}: BaseOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  if (!mounted) return null

  const scoped = !!containerRef?.current
  const target = scoped ? containerRef!.current! : document.body
  const posClass = scoped ? 'absolute' : 'fixed'

  const backdropStyle =
    backdrop === 'blur'
      ? {
          backgroundColor: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
          backdropFilter: visible ? 'blur(12px)' : 'blur(0px)',
          WebkitBackdropFilter: visible ? 'blur(12px)' : 'blur(0px)',
          pointerEvents: (visible ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        }
      : {
          backgroundColor: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
          pointerEvents: (visible ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        }

  return createPortal(
    <>
      <div
        className={`${posClass} inset-0 transition-all duration-300`}
        style={{ zIndex, ...backdropStyle }}
        onClick={onClose}
      />
      {children(visible)}
    </>,
    target,
  )
}
