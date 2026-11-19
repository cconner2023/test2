/**
 * SyncBanner — non-blocking strip for background setup that gates freshness but not
 * use (Signal key setup, vault replay). The surface under it stays interactive and
 * renders whatever is cached; this only says "more is on the way". Not a loader for
 * first paint: an empty list under it still gets its own skeleton.
 */
export function SyncBanner({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      className={`flex items-center gap-2 px-3 py-2 bg-themeblue2/10 border-b border-themeblue2/20 ${className}`}
    >
      <div className="w-3 h-3 border-2 border-themeblue2 border-t-transparent rounded-full animate-spin" />
      <span className="text-[10pt] text-themeblue2 font-medium">{label}</span>
    </div>
  )
}
