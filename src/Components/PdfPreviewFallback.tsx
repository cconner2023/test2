import { FileText } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'

/**
 * Shared fallback body for every in-app PDF preview — rendered inside the <object>
 * when the device can't inline-render the PDF (the common case on iOS Safari, our
 * majority platform). Used by PdfPreviewModal (note / label exports) and the property
 * DA 2062 previews (Da2062PdfView, Da2062Preview). Uses the `gate` EmptyState so the
 * surface reads as one of our primitives instead of a hand-rolled gray box; every
 * host already carries the Save / Download action in its chrome (which sits OUTSIDE
 * the <object>, so it stays reachable), so this body just explains and points at it.
 */
export function PdfPreviewFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        variant="gate"
        icon={<FileText size={28} strokeWidth={1.5} />}
        title="Preview not available here"
        subtitle="Use Save to download the PDF and open it on your device."
      />
    </div>
  )
}
