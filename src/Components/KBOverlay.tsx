import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface KBOverlayProps {
    title?: string
    isOpen: boolean
    onClose: () => void
    children: ReactNode
}

export function KBOverlay({ title, isOpen, onClose, children }: KBOverlayProps) {
    const [mounted, setMounted] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setMounted(true) // eslint-disable-line react-hooks/set-state-in-effect
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setOpen(true))
            })
        } else {
            setOpen(false)
            const t = setTimeout(() => setMounted(false), 300)
            return () => clearTimeout(t)
        }
    }, [isOpen])

    const handleClose = useCallback(() => {
        setOpen(false)
        setTimeout(onClose, 300)
    }, [onClose])

    if (!mounted) return null

    return (
        <>
            <div
                className={`absolute inset-0 z-10 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
                style={{ pointerEvents: open ? 'auto' : 'none' }}
                onClick={handleClose}
            />
            <div
                className={`absolute left-0 right-0 bottom-0 z-20 bg-themewhite3 rounded-t-2xl shadow-xl flex flex-col
                    transition-all duration-300 ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}
                style={{ minHeight: '40%', maxHeight: '60%' }}
            >
                {title ? (
                    <div className="flex-none flex items-center justify-between px-5 py-3 border-b border-tertiary/10">
                        <h3 className="text-[15px] font-semibold text-primary">{title}</h3>
                        <button
                            onClick={handleClose}
                            className="text-tertiary hover:text-secondary active:scale-95 transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex-none flex items-center justify-end px-5 pt-5 pb-2">
                        <button
                            onClick={handleClose}
                            className="text-tertiary hover:text-secondary active:scale-95 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {children}
                </div>
            </div>
        </>
    )
}
