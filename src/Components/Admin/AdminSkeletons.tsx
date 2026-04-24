/**
 * Loading skeletons for the admin lists + sidebar summary.
 * Uses the same bg-tertiary/10 + animate-pulse idiom found elsewhere
 * (Settings/StoragePanel). Heights match the real rows so the list
 * doesn't jump when data arrives.
 */

interface RowSkeletonProps {
  /** Width class for the title bar — varies row-to-row for a natural look */
  titleWidth?: string
  /** Width class for the subtitle bar */
  subtitleWidth?: string
  /** Show a small meta bar at the right (badges / last-active label) */
  showRight?: boolean
}

function AdminRowSkeleton({
  titleWidth = 'w-40',
  subtitleWidth = 'w-56',
  showRight = true,
}: RowSkeletonProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-tertiary/10 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className={`h-3 rounded-full bg-tertiary/10 ${titleWidth} max-w-full`} />
        <div className={`h-2 rounded-full bg-tertiary/10 ${subtitleWidth} max-w-full`} />
      </div>
      {showRight && <div className="h-2 w-10 rounded-full bg-tertiary/10 shrink-0" />}
    </div>
  )
}

/** List-card skeleton: rounded-2xl wrapper with N row skeletons inside. */
export function AdminListSkeleton({ rows = 5 }: { rows?: number }) {
  const widths: Array<Pick<RowSkeletonProps, 'titleWidth' | 'subtitleWidth'>> = [
    { titleWidth: 'w-48', subtitleWidth: 'w-64' },
    { titleWidth: 'w-36', subtitleWidth: 'w-52' },
    { titleWidth: 'w-44', subtitleWidth: 'w-60' },
    { titleWidth: 'w-40', subtitleWidth: 'w-48' },
    { titleWidth: 'w-52', subtitleWidth: 'w-56' },
  ]
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <AdminRowSkeleton key={i} {...widths[i % widths.length]} />
      ))}
    </div>
  )
}

/** Sidebar summary skeleton — stats rows, divider, hierarchy rows. */
export function AdminSummarySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className="flex flex-col h-full animate-pulse"
    >
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-3 rounded-full bg-tertiary/10 flex-1 max-w-[80px]" />
          <div className="h-3 w-6 rounded-full bg-tertiary/10" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 rounded-full bg-tertiary/10 flex-1 max-w-[60px]" />
          <div className="h-3 w-6 rounded-full bg-tertiary/10" />
        </div>
      </div>

      <div className="border-b border-primary/10 mx-4" />

      <div className="px-4 py-2.5">
        <div className="h-2 w-16 rounded-full bg-tertiary/10" />
      </div>

      <div className="flex-1 space-y-2 px-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 py-1" style={{ paddingLeft: `${i === 3 ? 16 : 0}px` }}>
            <div className="h-3 rounded-full bg-tertiary/10 flex-1 max-w-[140px]" />
            <div className="h-2 w-5 rounded-full bg-tertiary/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
