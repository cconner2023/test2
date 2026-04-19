import { useState, useMemo, useCallback } from 'react';
import { Map, Trash2, Plus, MapPin, Route as RouteIcon, ArrowDownToLine, Wifi, X, Loader2 } from 'lucide-react';
import type { MapOverlay } from '../../Types/MapOverlayTypes';
import type { TileMetadata } from '../../lib/mapTileService';
import { formatTileBytes } from '../../lib/mapTileService';
import { SearchInput } from '../SearchInput';
import { EmptyState } from '../EmptyState';

interface OverlayListProps {
  overlays: MapOverlay[];
  onSelect: (overlay: MapOverlay) => void;
  onDelete: (overlayId: string) => void;
  onNewOverlay: () => void;
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
  if (counts.waypoint) parts.push(`${counts.waypoint} waypoint${counts.waypoint > 1 ? 's' : ''}`);
  if (counts.route) parts.push(`${counts.route} route${counts.route > 1 ? 's' : ''}`);
  if (counts.area) parts.push(`${counts.area} area${counts.area > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(', ') : 'No features';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function OverlayList({
  overlays,
  onSelect,
  onDelete,
  onNewOverlay,
  tileMeta,
  downloadingId,
  downloadProgress,
  onDownloadTiles,
  onEvictTiles,
}: OverlayListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return overlays;
    return overlays.filter((o) => o.name.toLowerCase().includes(q));
  }, [overlays, search]);

  const handleDelete = useCallback((e: React.MouseEvent, overlayId: string) => {
    e.stopPropagation();
    onDelete(overlayId);
  }, [onDelete]);

  const handleDownload = useCallback((e: React.MouseEvent, overlay: MapOverlay) => {
    e.stopPropagation();
    onDownloadTiles(overlay);
  }, [onDownloadTiles]);

  const handleEvict = useCallback((e: React.MouseEvent, overlayId: string) => {
    e.stopPropagation();
    onEvictTiles(overlayId);
  }, [onEvictTiles]);

  if (overlays.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <EmptyState
          icon={<Map size={40} />}
          title="No Overlays"
          subtitle="No overlays. Create one to begin."
          action={{ label: 'New Overlay', onClick: onNewOverlay }}
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      <div className="px-4 pt-3 pb-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search overlays..."
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <EmptyState
            title="No matches"
            subtitle="No matches."
            className="py-12"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((overlay) => {
              const meta = tileMeta.get(overlay.id);
              const isDownloading = downloadingId === overlay.id;
              const isCached = !!meta;

              return (
                <button
                  key={overlay.id}
                  type="button"
                  onClick={() => onSelect(overlay)}
                  className="w-full text-left bg-themewhite2 dark:bg-themegray rounded-xl p-4
                    active:scale-95 transition-transform duration-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{overlay.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-tertiary">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          <RouteIcon size={12} />
                          {featureSummary(overlay)}
                        </span>
                      </div>
                      <p className="text-xs text-tertiary/60 mt-1">
                        Updated {formatDate(overlay.updated_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Tile cache control */}
                      {isDownloading ? (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-themeblue3/10">
                          <Loader2 size={14} className="text-themeblue3 animate-spin shrink-0" />
                          <span className="text-[10px] font-mono text-themeblue3 tabular-nums">
                            {downloadProgress
                              ? `${downloadProgress.done}/${downloadProgress.total}`
                              : '…'}
                          </span>
                        </div>
                      ) : isCached ? (
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-themegreen/10">
                            <Wifi size={13} className="text-themegreen shrink-0" />
                            <span className="text-[10px] font-medium text-themegreen">
                              {formatTileBytes(meta.sizeBytes)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleEvict(e, overlay.id)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 active:scale-95 transition-all"
                            aria-label="Remove offline tiles"
                          >
                            <X size={14} className="text-tertiary/60" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDownload(e, overlay)}
                          disabled={downloadingId !== null}
                          className="p-2 rounded-lg hover:bg-themeblue3/10 active:scale-95
                            transition-all disabled:opacity-30 disabled:pointer-events-none"
                          aria-label={`Download tiles for ${overlay.name}`}
                        >
                          <ArrowDownToLine size={16} className="text-themeblue3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, overlay.id)}
                        className="p-2 rounded-lg hover:bg-themeredred/10 active:scale-95 transition-all duration-300"
                        aria-label={`Delete ${overlay.name}`}
                      >
                        <Trash2 size={16} className="text-themeredred" />
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNewOverlay}
        className="bg-themeblue3 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center
          absolute bottom-6 right-6 active:scale-95 transition-all duration-300"
        aria-label="New Overlay"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
