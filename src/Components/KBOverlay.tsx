import type { ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'

interface KBOverlayProps {
    title?: string
    isOpen: boolean
    onClose: () => void
    children: ReactNode
}

export function KBOverlay({ title, isOpen, onClose, children }: KBOverlayProps) {
    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title={title} maxHeight="60dvh" draggable={false}>
            {children}
        </BottomSheet>
    )
}
