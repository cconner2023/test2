/* Modal tokens: bg-themewhite rounded-2xl shadow-2xl border-tertiary/10. Ref: UpdateNotification */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Trash2, X } from 'lucide-react'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { clearDiag, formatDiag, getDiagEntries, subscribeDiag } from '../../lib/diagLog'

/** Full on-device error log (lib/diagLog) — the iOS console substitute. */
export function ErrorLogSheet({ onClose }: { onClose: () => void }) {
    const [, setTick] = useState(0)
    const [copied, setCopied] = useState(false)

    useEffect(() => subscribeDiag(() => setTick(t => t + 1)), [])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(formatDiag())
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch { /* clipboard unavailable — text is selectable */ }
    }

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/15" onClick={onClose} />
            <div className="relative w-full sm:max-w-lg max-h-[80vh] flex flex-col bg-themewhite rounded-t-2xl sm:rounded-2xl shadow-2xl border border-tertiary/10 animate-surface-in pb-[env(safe-area-inset-bottom,0px)]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                    <p className="text-sm font-semibold text-primary">{copied ? 'Copied' : 'Error Log'}</p>
                    <div className="flex items-center gap-2">
                        <ActionButton icon={Copy} label="Copy log" onClick={handleCopy} />
                        <ActionButton icon={Trash2} label="Clear log" onClick={clearDiag} variant="danger" />
                        <ActionButton icon={X} label="Close" onClick={onClose} />
                    </div>
                </div>
                <pre className="flex-1 overflow-auto px-4 py-3 text-[9pt] leading-snug text-primary whitespace-pre-wrap break-words select-text">
                    {formatDiag(getDiagEntries()) || 'No entries.'}
                </pre>
            </div>
        </div>,
        document.body,
    )
}
