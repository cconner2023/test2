import { useState, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Check,
  Plus,
  Trash2,
  ArrowDownToLine,
  Wifi,
  Loader2,
  Grid3X3,
  ChevronRight,
  ArrowUpRight,
  X,
} from 'lucide-react';
import type { MapOverlay } from '../../Types/MapOverlayTypes';
import type { TileMetadata } from '../../lib/mapTileService';
import { PreviewOverlay } from '../PreviewOverlay';
import { EmptyState } from '../EmptyState';
import { ActionButton } from '../ActionButton';
import { ActionPill } from '../ActionPill';
import { ConfirmDialog } from '../ConfirmDialog';
import { Z } from '../BaseOverlay';

interface MapSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  overlays: MapOverlay[];
  activeOverlayId: string | null;
  visibleOverlayIds: Set<string>;
  onMakeActive: (overlay: MapOverlay) => void;
  onToggleVisible: (overlayId: string) => void;
  onDelete: (overlayId: string) => void;
  onNewOverlay: () => void;
  tileMeta: Map<string, TileMetadata>;
  downloadingId: string | null;
  downloadProgress: { done: number; total: number } | null;
  onDownloadTiles: (overlay: MapOverlay) => void;
  onEvictTiles: (overlayId: string) => void;
  /** When false, the overlays section is hidden — desktop owns overlay browsing via the left-pane tree. */
  showOverlays?: boolean;
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

interface ActionsAnchor {
  rect: DOMRect;
  overlayId: string;
}

export function MapSettingsDrawer({
  isOpen,
  onClose,
  showGrid,
  onToggleGrid,
  overlays,
  activeOverlayId,
  visibleOverlayIds,
  onMakeActive,
  onToggleVisible,
  onDelete,
  onNewOverlay,
  tileMeta,
  downloadingId,
  downloadProgress,
  onDownloadTiles,
  onEvictTiles,
  showOverlays = true,
}: MapSettingsDrawerProps) {
  const [actionsAnchor, setActionsAnchor] = useState<ActionsAnchor | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const confirmDeleteOverlay = confirmDeleteId
    ? overlays.find(o => o.id === confirmDeleteId) ?? null
    : null;

  const actionsOverlay = actionsAnchor
    ? overlays.find(o => o.id === actionsAnchor.overlayId) ?? null
    : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return overlays;
    return overlays.filter(o => o.name.toLowerCase().includes(q));
  }, [overlays, search]);

  const handleClose = () => {
    setActionsAnchor(null);
    setSearch('');
    onClose();
  };

  const closeActions = () => setActionsAnchor(null);

  const handleNew = () => {
    onNewOverlay();
    handleClose();
  };

  // ── Per-overlay action callbacks (close the actions popover, then act) ──
  const handleOpen = (overlay: MapOverlay) => {
    closeActions();
    onMakeActive(overlay);
    onClose();
  };

  const handleToggleVis = (overlay: MapOverlay) => {
    onToggleVisible(overlay.id);
    closeActions();
  };

  const handleCacheAction = (overlay: MapOverlay, isCached: boolean) => {
    closeActions();
    if (isCached) onEvictTiles(overlay.id);
    else onDownloadTiles(overlay);
  };

  const handleRequestDelete = (overlay: MapOverlay) => {
    closeActions();
    setTimeout(() => setConfirmDeleteId(overlay.id), 320);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) onDelete(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  return (
    <>
      <PreviewOverlay
        isOpen={isOpen && !confirmDeleteOverlay}
        onClose={handleClose}
        anchorRect={null}
        title="Map Settings"
        maxWidth={380}
      >
        <div className="flex flex-col gap-4 p-4">
          {/* Grid toggle row */}
          <div className="flex items-center justify-between rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-full bg-themewhite flex items-center justify-center text-tertiary">
                <Grid3X3 size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">MGRS grid</p>
                <p className="text-[10pt] text-tertiary truncate">Overlay coordinate grid</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleGrid}
              aria-pressed={showGrid}
              className={`shrink-0 w-11 h-6 rounded-full relative transition-colors duration-200
                ${showGrid ? 'bg-themeblue3' : 'bg-tertiary/20'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-themewhite shadow-sm transition-all duration-200
                  ${showGrid ? 'left-[1.375rem]' : 'left-0.5'}`}
              />
            </button>
          </div>

          {/* Overlays section — mobile-only; desktop browses via the left-pane tree */}
          {showOverlays && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wide">Overlays</span>
            </div>

            {overlays.length === 0 ? (
              <EmptyState
                title="No overlays yet"
                action={{ icon: Plus, label: 'New overlay', onClick: () => handleNew() }}
              />
            ) : (
              <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden relative">
                {overlays.length > 3 && (
                  <div className="px-3 pt-2">
                    <input
                      type="search"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search overlays…"
                      className="w-full px-3 py-1.5 rounded-lg bg-themewhite text-[10pt] text-primary
                        placeholder:text-tertiary outline-none border border-tertiary/20 transition-all
                        [&::-webkit-search-cancel-button]:hidden"
                    />
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-[10pt] text-tertiary text-center py-4">No matches</p>
                  ) : (
                    filtered.map(overlay => {
                      const isActive = overlay.id === activeOverlayId;
                      const isVisible = visibleOverlayIds.has(overlay.id);
                      const isCached = tileMeta.has(overlay.id);
                      const isDownloading = downloadingId === overlay.id;

                      return (
                        <button
                          key={overlay.id}
                          type="button"
                          onClick={(e) => setActionsAnchor({
                            rect: e.currentTarget.getBoundingClientRect(),
                            overlayId: overlay.id,
                          })}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                            ${isActive ? 'bg-themeblue2/10' : 'hover:bg-primary/5 active:bg-primary/5'}`}
                        >
                          <div className="w-8 h-8 shrink-0 rounded-full bg-themewhite flex items-center justify-center">
                            {isVisible
                              ? <Eye size={14} className={isActive ? 'text-themeblue2' : 'text-tertiary'} />
                              : <EyeOff size={14} className="text-tertiary/60" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium truncate
                                ${isActive ? 'text-themeblue2' : 'text-primary'}`}>
                                {overlay.name || 'Unnamed'}
                              </p>
                              {isActive && <Check size={12} className="shrink-0 text-themeblue2" />}
                              {isCached && !isDownloading && (
                                <Wifi size={12} className="shrink-0 text-themegreen" aria-label="Cached for offline" />
                              )}
                              {isDownloading && (
                                <Loader2 size={12} className="shrink-0 text-themeblue2 animate-spin" />
                              )}
                            </div>
                            <p className="text-[10pt] text-tertiary truncate">{featureSummary(overlay)}</p>
                          </div>
                          <ChevronRight size={16} className="shrink-0 text-tertiary/60" />
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <ActionButton icon={Plus} label="New overlay" onClick={handleNew} />
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </PreviewOverlay>

      {/* Per-overlay actions — anchored, fresh popover (no back nesting) */}
      <PreviewOverlay
        isOpen={!!actionsOverlay}
        onClose={closeActions}
        anchorRect={actionsAnchor?.rect ?? null}
        title={actionsOverlay?.name || 'Overlay'}
        maxWidth={320}
        zIndex={Z.POPOVER + 20}
        footer={actionsOverlay ? (() => {
          const overlay = actionsOverlay;
          const isActive = overlay.id === activeOverlayId;
          const isVisible = visibleOverlayIds.has(overlay.id);
          const isCached = tileMeta.has(overlay.id);
          const isDownloading = downloadingId === overlay.id;
          const noFeatures = overlay.features.length === 0;
          const cacheBusy = downloadingId !== null && !isDownloading;

          return (
            <ActionPill>
              <ActionButton
                icon={ArrowUpRight}
                label={isActive ? 'Already open' : 'Open'}
                variant={isActive ? 'disabled' : 'success'}
                onClick={() => !isActive && handleOpen(overlay)}
              />
              <ActionButton
                icon={isVisible ? EyeOff : Eye}
                label={isVisible ? 'Hide on map' : 'Show on map'}
                onClick={() => handleToggleVis(overlay)}
              />
              <ActionButton
                icon={isDownloading ? Loader2 : isCached ? X : ArrowDownToLine}
                label={
                  isDownloading
                    ? (downloadProgress
                        ? `Downloading ${downloadProgress.done}/${downloadProgress.total}`
                        : 'Downloading…')
                    : isCached
                      ? 'Remove cached tiles'
                      : noFeatures
                        ? 'Add a feature first'
                        : 'Download tiles for offline'
                }
                variant={
                  isDownloading || (!isCached && (noFeatures || cacheBusy))
                    ? 'disabled'
                    : isCached ? 'danger' : 'default'
                }
                onClick={() => {
                  if (isDownloading) return;
                  if (!isCached && (noFeatures || cacheBusy)) return;
                  handleCacheAction(overlay, isCached);
                }}
              />
              <ActionButton
                icon={Trash2}
                label="Delete overlay"
                variant="danger"
                onClick={() => handleRequestDelete(overlay)}
              />
            </ActionPill>
          );
        })() : undefined}
      >
        {actionsOverlay && (
          <div className="px-4 py-3">
            <p className="text-[10pt] text-tertiary">{featureSummary(actionsOverlay)}</p>
          </div>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmDeleteOverlay}
        title="Delete this overlay?"
        subtitle={
          confirmDeleteOverlay
            ? `${confirmDeleteOverlay.name || 'Unnamed'} and any cached tiles will be removed. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  );
}

export default MapSettingsDrawer;
