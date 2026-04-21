import { useState, useMemo } from 'react';
import { Eye, EyeOff, Check, Plus, Trash2, ArrowDownToLine, Wifi, Loader2, X } from 'lucide-react';
import type { MapOverlay } from '../../Types/MapOverlayTypes';
import type { TileMetadata } from '../../lib/mapTileService';
import { ActionButton } from '../ActionButton';

interface OverlayPopoverProps {
  overlays: MapOverlay[];
  activeOverlayId: string | null;
  visibleOverlayIds: Set<string>;
  onMakeActive: (overlay: MapOverlay) => void;
  onToggleVisible: (overlayId: string) => void;
  onDelete: (overlayId: string) => void;
  onNewOverlay: () => void;
  onClose: () => void;
  tileMeta: Map<string, TileMetadata>;
  downloadingId: string | null;
  downloadProgress: { done: number; total: number } | null;
  onDownloadTiles: (overlay: MapOverlay) => void;
  onEvictTiles: (overlayId: string) => void;
}

function featureSummary(overlay: MapOverlay): string {
  const counts: Record<string, number> = {};
  for (const f of overlay.features) {
    counts[f.type] = (counts[f.type] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (counts.waypoint) parts.push(`${counts.waypoint}wp`);
  if (counts.route) parts.push(`${counts.route}rt`);
  if (counts.area) parts.push(`${counts.area}ar`);
  return parts.length > 0 ? parts.join(' · ') : 'Empty';
}

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

export function OverlayPopover({
  overlays,
  activeOverlayId,
  visibleOverlayIds,
  onMakeActive,
  onToggleVisible,
  onDelete,
  onNewOverlay,
  onClose,
  tileMeta,
  downloadingId,
  downloadProgress,
  onDownloadTiles,
  onEvictTiles,
}: OverlayPopoverProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return overlays;
    return overlays.filter(o => o.name.toLowerCase().includes(q));
  }, [overlays, search]);

  return (
    <div className="bg-themewhite rounded-2xl shadow-xl border border-primary/10 w-72 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between pl-3 pr-1 pt-1 pb-1">
        <span className="text-[9pt] md:text-[9pt] font-semibold text-secondary uppercase tracking-wide">
          Overlays
        </span>
        <div className="flex items-center">
          <ActionButton icon={Plus} label="New overlay" onClick={onNewOverlay} />
          <ActionButton icon={X} label="Close" onClick={onClose} />
        </div>
      </div>

      {/* Search — only when list is long */}
      {overlays.length > 3 && (
        <div className="px-3 pb-2">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full px-3 py-1.5 rounded-lg bg-themewhite2 text-[9pt] md:text-[9pt] text-primary
              placeholder:text-tertiary outline-none border border-tertiary/20 transition-all
              [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      )}

      {/* Overlay rows */}
      <div className="max-h-72 overflow-y-auto pb-1">
        {filtered.length === 0 ? (
          <p className="text-[9pt] md:text-[9pt] text-tertiary text-center py-4">No overlays</p>
        ) : (
          filtered.map(overlay => {
            const isActive = overlay.id === activeOverlayId;
            const isVisible = visibleOverlayIds.has(overlay.id);
            const isDownloading = downloadingId === overlay.id;
            const isCached = tileMeta.has(overlay.id);

            return (
              <div
                key={overlay.id}
                role="button"
                tabIndex={0}
                onClick={() => onMakeActive(overlay)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onMakeActive(overlay); }}
                className={`flex items-center gap-0.5 px-1 py-0.5 cursor-pointer transition-colors
                  ${isActive ? 'bg-themeblue2/10' : 'hover:bg-primary/5'}`}
              >
                {/* Visibility toggle */}
                <div onClick={stop}>
                  <ActionButton
                    icon={isVisible ? Eye : EyeOff}
                    label={isVisible ? 'Hide overlay' : 'Show overlay'}
                    onClick={() => onToggleVisible(overlay.id)}
                    variant={isActive ? 'disabled' : 'default'}
                  />
                </div>

                {/* Name + summary */}
                <div className="flex-1 min-w-0 px-1">
                  <div className="flex items-center gap-1">
                    <p className={`text-[9pt] md:text-[9pt] font-medium truncate
                      ${isActive ? 'text-themeblue2' : 'text-primary'}`}>
                      {overlay.name || 'Unnamed'}
                    </p>
                    {isActive && <Check size={10} className="shrink-0 text-themeblue2" />}
                    {isCached && !isDownloading && <Wifi size={10} className="shrink-0 text-themegreen" />}
                  </div>
                  <p className="text-[9pt] md:text-[9pt] text-tertiary">{featureSummary(overlay)}</p>
                </div>

                {/* Cache action */}
                {isDownloading ? (
                  <div className="w-9 h-9 flex items-center justify-center shrink-0">
                    <Loader2 size={16} className="text-themeblue2 animate-spin" />
                    {downloadProgress && (
                      <span className="sr-only">{downloadProgress.done}/{downloadProgress.total}</span>
                    )}
                  </div>
                ) : isCached ? (
                  <div onClick={stop}>
                    <ActionButton
                      icon={X}
                      label="Remove cached tiles"
                      onClick={() => onEvictTiles(overlay.id)}
                      variant="danger"
                    />
                  </div>
                ) : (
                  <div onClick={stop}>
                    <ActionButton
                      icon={ArrowDownToLine}
                      label="Download tiles"
                      onClick={() => onDownloadTiles(overlay)}
                      variant={downloadingId !== null ? 'disabled' : 'default'}
                    />
                  </div>
                )}

                {/* Delete */}
                <div onClick={stop}>
                  <ActionButton
                    icon={Trash2}
                    label="Delete overlay"
                    onClick={() => onDelete(overlay.id)}
                    variant="danger"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
