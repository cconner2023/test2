/* ────────────────────────────────────────────────────────────
   FeedbackModal — Shared success/warning popup overlay.
   ──────────────────────────────────────────────────────────── */
export const FeedbackModal = ({ visible, variant, title, subtitle }: {
  visible: boolean;
  variant: 'success' | 'warning';
  title: string;
  subtitle: string;
}) => {
  if (!visible) return null
  const isSuccess = variant === 'success'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div className="bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 px-8 py-6 flex flex-col items-center gap-3 animate-[fadeInScale_0.3s_ease-out]">
        <div className={`w-12 h-12 rounded-full ${isSuccess ? 'bg-green-500/15' : 'bg-amber-500/15'} flex items-center justify-center`}>
          <svg className={`w-6 h-6 ${isSuccess ? 'text-green-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSuccess ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            )}
          </svg>
        </div>
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="text-xs text-tertiary/60">{subtitle}</p>
      </div>
    </div>
  )
}
