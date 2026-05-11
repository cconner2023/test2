import { useState, useMemo, useRef } from 'react';
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
  Upload,
  FileDown,
  Map as MapIcon,
  FileText,
} from 'lucide-react';
import type { MapOverlay } from '../../Types/MapOverlayTypes';
import type { TileMetadata, TileSource } from '../../lib/mapTileService';
import { TILE_SOURCES } from '../../lib/mapTileService';
import { PreviewOverlay } from '../PreviewOverlay';
import { EmptyState } from '../EmptyState';
import { ActionButton } from '../ActionButton';
import { SearchInput } from '../SearchInput';
import { ActionPill } from '../ActionPill';
import { ConfirmDialog } from '../ConfirmDialog';
import { Z } from '../BaseOverlay';
import { useMapPrefsStore } from '../../stores/useMapPrefsStore';
import type { BearingReference } from '../../lib/declination';
import type { CoordDisplay } from '../../stores/useMapPrefsStore';

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
  /** Import GPX/KML — creates a new overlay seeded with parsed features. */
  onImportFile?: (file: File) => void;
  /** Export an overlay's features as GPX or KML. */
  onExportOverlay?: (overlay: MapOverlay, format: 'gpx' | 'kml') => void;
  /** Phase 3 — import an .mbtiles file as a runtime-registered basemap. */
  onImportMBTiles?: (file: File) => void;
  /** Open the manual-bounds geo-PDF import form (Phase 3.2a). */
  onImportGeoPdf?: () => void;
  /** Active import progress (Phase 3). Shared between MBTiles and geo-PDF. */
  mbtilesImportProgress?: { name: string; done: number; total: number; phase: string } | null;
  /** Delete an imported basemap (Phase 3). */
  onDeleteImportedBasemap?: (sourceId: string) => void;
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
  onImportFile,
  onExportOverlay,
  onImportMBTiles,
  onImportGeoPdf,
  mbtilesImportProgress,
  onDeleteImportedBasemap,
  showOverlays = true,
}: MapSettingsDrawerProps) {
  const [actionsAnchor, setActionsAnchor] = useState<ActionsAnchor | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mbtilesInputRef = useRef<HTMLInputElement | null>(null);
  const bearingReference = useMapPrefsStore(s => s.bearingReference);
  const setBearingReference = useMapPrefsStore(s => s.setBearingReference);
  const coordDisplay = useMapPrefsStore(s => s.coordDisplay);
  const setCoordDisplay = useMapPrefsStore(s => s.setCoordDisplay);
  const basemapId = useMapPrefsStore(s => s.basemapId);
  const setBasemapId = useMapPrefsStore(s => s.setBasemapId);

  const BASEMAPS = useMemo<TileSource[]>(() => Object.values(TILE_SOURCES), []);
  const activeBasemap = TILE_SOURCES[basemapId] ?? TILE_SOURCES.osm;

  const BEARING_REFS: { value: BearingReference; label: string; sub: string }[] = [
    { value: 'true', label: 'True', sub: 'T' },
    { value: 'grid', label: 'Grid', sub: 'G' },
    { value: 'magnetic', label: 'Magnetic', sub: 'M' },
  ];

  const COORD_DISPLAYS: { value: CoordDisplay; label: string }[] = [
    { value: 'mgrs', label: 'MGRS' },
    { value: 'utm', label: 'UTM' },
    { value: 'latlng', label: 'Lat/Lng' },
  ];

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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImportFile) return;
    onImportFile(file);
    handleClose();
  };

  const handleMbtilesClick = () => mbtilesInputRef.current?.click();

  const handleMbtilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImportMBTiles) return;
    onImportMBTiles(file);
    // Don't close — keep the panel open so the user sees progress.
  };

  const handleExport = (overlay: MapOverlay, format: 'gpx' | 'kml') => {
    closeActions();
    onExportOverlay?.(overlay, format);
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

          {/* Bearing reference selector */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-primary">Bearing reference</p>
              <span className="text-[10pt] font-mono text-tertiary">{bearingReference[0].toUpperCase()}</span>
            </div>
            <div className="flex rounded-lg bg-themewhite p-0.5">
              {BEARING_REFS.map(({ value, label, sub }) => {
                const active = bearingReference === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBearingReference(value)}
                    aria-pressed={active}
                    className={`flex-1 px-2 py-1.5 rounded-md text-[11pt] font-medium transition-colors
                      ${active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                  >
                    {label}
                    <span className="ml-1 font-mono text-[9pt] opacity-60">{sub}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10pt] text-tertiary">
              {bearingReference === 'true' && 'Bearings reference geographic north.'}
              {bearingReference === 'grid' && 'Bearings reference UTM grid north (corrected for convergence).'}
              {bearingReference === 'magnetic' && 'Bearings reference magnetic north (WMM, current epoch).'}
            </p>
          </div>

          {/* Basemap selector */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden relative">
            <div className="px-4 py-3 border-b border-tertiary/10 pr-12">
              <p className="text-sm font-medium text-primary">Basemap</p>
              <p className="text-[10pt] text-tertiary truncate">{activeBasemap.attribution}</p>
            </div>
            {(onImportMBTiles || onImportGeoPdf) && (
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {onImportGeoPdf && (
                  <ActionButton icon={FileText} label="Import geo-PDF" onClick={onImportGeoPdf} />
                )}
                {onImportMBTiles && (
                  <ActionButton icon={MapIcon} label="Import MBTiles" onClick={handleMbtilesClick} />
                )}
              </div>
            )}
            <div className="flex flex-col">
              {BASEMAPS.map(src => {
                const active = src.id === basemapId;
                return (
                  <div
                    key={src.id}
                    className={`relative w-full flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0 border-tertiary/10
                      ${active ? 'bg-themeblue2/10' : 'hover:bg-primary/5 active:bg-primary/5'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setBasemapId(src.id)}
                      aria-pressed={active}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-medium truncate ${active ? 'text-themeblue2' : 'text-primary'}`}>
                          {src.name}
                        </p>
                        {active && <Check size={12} className="shrink-0 text-themeblue2" />}
                        {src.imported && (
                          <span className="shrink-0 text-[9pt] font-medium px-1.5 py-px rounded bg-themeblue3/15 text-themeblue3 uppercase tracking-wide">Imported</span>
                        )}
                        {!src.policy.allowBulkCache && !src.imported && (
                          <span className="shrink-0 text-[9pt] font-medium px-1.5 py-px rounded bg-tertiary/15 text-tertiary uppercase tracking-wide">Live</span>
                        )}
                      </div>
                      {src.description && (
                        <p className="text-[10pt] text-tertiary truncate">{src.description}</p>
                      )}
                    </button>
                    {src.imported && onDeleteImportedBasemap && (
                      <button
                        type="button"
                        onClick={() => onDeleteImportedBasemap(src.id)}
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                        aria-label={`Delete ${src.name}`}
                        title="Delete imported basemap"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {mbtilesImportProgress && (
              <div className="px-4 py-2 border-t border-tertiary/10 bg-themewhite">
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 size={12} className="text-themeblue3 animate-spin" />
                  <span className="text-[10pt] font-medium text-primary truncate">{mbtilesImportProgress.name}</span>
                  <span className="text-[9pt] text-tertiary uppercase tracking-wide ml-auto">{mbtilesImportProgress.phase}</span>
                </div>
                <div className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                  <div
                    className="h-full bg-themeblue3 transition-all duration-200"
                    style={{
                      width: mbtilesImportProgress.total > 0
                        ? `${Math.min(100, (mbtilesImportProgress.done / mbtilesImportProgress.total) * 100)}%`
                        : '15%',
                    }}
                  />
                </div>
                <p className="text-[9pt] text-tertiary mt-1 tabular-nums">
                  {mbtilesImportProgress.done.toLocaleString()} / {mbtilesImportProgress.total.toLocaleString()} tiles
                </p>
              </div>
            )}
          </div>

          {onImportMBTiles && (
            <input
              ref={mbtilesInputRef}
              type="file"
              accept=".mbtiles,application/x-sqlite3"
              onChange={handleMbtilesPicked}
              className="hidden"
            />
          )}

          {/* Coord display selector */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
            <p className="text-sm font-medium text-primary mb-2">Coordinate display</p>
            <div className="flex rounded-lg bg-themewhite p-0.5">
              {COORD_DISPLAYS.map(({ value, label }) => {
                const active = coordDisplay === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCoordDisplay(value)}
                    aria-pressed={active}
                    className={`flex-1 px-2 py-1.5 rounded-md text-[11pt] font-medium transition-colors
                      ${active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10pt] text-tertiary">
              Format used for the on-map readout pill. The detail overlay always shows all formats.
            </p>
          </div>

          {/* Overlays section — mobile-only; desktop browses via the left-pane tree */}
          {showOverlays && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wide">Overlays</span>
            </div>

            {overlays.length === 0 ? (
              <>
                <EmptyState
                  title="No overlays yet"
                  action={{ icon: Plus, label: 'New overlay', onClick: () => handleNew() }}
                />
                {onImportFile && (
                  <button
                    type="button"
                    onClick={handleImportClick}
                    className="self-center text-[10pt] text-themeblue2 hover:underline"
                  >
                    or import from GPX / KML…
                  </button>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden relative">
                {overlays.length > 3 && (
                  <div className="px-3 pt-2">
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Search overlays…"
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
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {onImportFile && (
                    <ActionButton icon={Upload} label="Import GPX/KML" onClick={handleImportClick} />
                  )}
                  <ActionButton icon={Plus} label="New overlay" onClick={handleNew} />
                </div>
              </div>
            )}
          </div>
          )}

          {/* Hidden file picker for GPX/KML import. */}
          {onImportFile && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml"
              onChange={handleFilePicked}
              className="hidden"
            />
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
          const bulkCacheBlocked = !activeBasemap.policy.allowBulkCache;

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
                      : bulkCacheBlocked
                        ? `${activeBasemap.name} — live only`
                        : noFeatures
                          ? 'Add a feature first'
                          : 'Download tiles for offline'
                }
                variant={
                  isDownloading || (!isCached && (noFeatures || cacheBusy || bulkCacheBlocked))
                    ? 'disabled'
                    : isCached ? 'danger' : 'default'
                }
                onClick={() => {
                  if (isDownloading) return;
                  if (!isCached && (noFeatures || cacheBusy || bulkCacheBlocked)) return;
                  handleCacheAction(overlay, isCached);
                }}
              />
              {onExportOverlay && (
                <>
                  <ActionButton
                    icon={FileDown}
                    label="Export GPX"
                    variant={noFeatures ? 'disabled' : 'default'}
                    onClick={() => !noFeatures && handleExport(overlay, 'gpx')}
                  />
                  <ActionButton
                    icon={FileDown}
                    label="Export KML"
                    variant={noFeatures ? 'disabled' : 'default'}
                    onClick={() => !noFeatures && handleExport(overlay, 'kml')}
                  />
                </>
              )}
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
