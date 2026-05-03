import { useState, useMemo, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Pencil, Trash2, X, Check, ArrowDownToLine, Wifi, Loader2 } from 'lucide-react';
import { ContextMenu } from '../ContextMenu';
import type { LocalMapOverlay, OverlayFeature } from '../../Types/MapOverlayTypes';
import type { TileMetadata } from '../../lib/mapTileService';

interface MapOverlayTreeProps {
  overlays: LocalMapOverlay[];
  activeOverlayId: string | null;
  visibleOverlayIds: Set<string>;
  selectedFeatureId: string | null;
  onMakeActive: (overlay: LocalMapOverlay) => void;
  onToggleVisible: (overlayId: string) => void;
  onRenameOverlay: (overlay: LocalMapOverlay, name: string) => void;
  onDeleteOverlay: (overlayId: string) => void;
  onSelectFeature: (feature: OverlayFeature, overlayId: string) => void;
  tileMeta: Map<string, TileMetadata>;
  downloadingId: string | null;
  onDownloadTiles: (overlay: LocalMapOverlay) => void;
  onEvictTiles: (overlayId: string) => void;
}

export function MapOverlayTree({
  overlays,
  activeOverlayId,
  visibleOverlayIds,
  selectedFeatureId,
  onMakeActive,
  onToggleVisible,
  onRenameOverlay,
  onDeleteOverlay,
  onSelectFeature,
  tileMeta,
  downloadingId,
  onDownloadTiles,
  onEvictTiles,
}: MapOverlayTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ overlayId: string; x: number; y: number } | null>(null);

  const sorted = useMemo(
    () => [...overlays].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [overlays],
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startRename = useCallback((overlay: LocalMapOverlay) => {
    setRenamingId(overlay.id);
    setRenameValue(overlay.name);
    setTimeout(() => renameInputRef.current?.focus(), 30);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    const overlay = overlays.find(o => o.id === renamingId);
    if (overlay && trimmed && trimmed !== overlay.name) {
      onRenameOverlay(overlay, trimmed);
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, overlays, onRenameOverlay]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Tree body */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {sorted.length === 0 ? (
          <div className="px-6 py-8 text-center text-[10pt] text-tertiary">
            No overlays yet.
          </div>
        ) : (
          sorted.map((overlay) => {
            const hasChildren = overlay.features.length > 0;
            const isCollapsed = collapsed.has(overlay.id);
            const isActive = activeOverlayId === overlay.id;
            const isVisible = visibleOverlayIds.has(overlay.id);
            const isRenaming = renamingId === overlay.id;
            const isCached = tileMeta.has(overlay.id);
            const isDownloading = downloadingId === overlay.id;

            return (
              <div key={overlay.id}>
                {/* Overlay row */}
                <div
                  className={`group flex items-center gap-1.5 py-2 pr-2 transition-colors ${
                    isActive
                      ? 'bg-primary/5 border-l-2 border-l-primary/40'
                      : 'hover:bg-secondary/5 border-l-2 border-l-transparent'
                  }`}
                  style={{ paddingLeft: '12px' }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ overlayId: overlay.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  {/* Chevron */}
                  {hasChildren ? (
                    <button
                      type="button"
                      className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
                      onClick={() => toggleCollapse(overlay.id)}
                      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                  ) : (
                    <span className="w-[18px] shrink-0" />
                  )}

                  {/* Name / inline rename */}
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      onBlur={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 text-[10pt] font-medium text-primary bg-transparent border-b border-themeblue3/50 focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMakeActive(overlay)}
                      className="flex-1 min-w-0 text-left text-[10pt] font-medium text-primary truncate"
                      title={overlay.name}
                    >
                      {overlay.name || 'Untitled'}
                    </button>
                  )}

                  {/* Tile-cache state indicator */}
                  {!isRenaming && isDownloading && (
                    <Loader2 size={12} className="shrink-0 text-themeblue2 animate-spin" aria-label="Downloading tiles" />
                  )}
                  {!isRenaming && !isDownloading && isCached && (
                    <Wifi size={12} className="shrink-0 text-themegreen" aria-label="Cached for offline" />
                  )}

                  {/* Inline controls */}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isRenaming ? (
                      <>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={cancelRename}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                          aria-label="Cancel rename"
                        >
                          <X size={13} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={commitRename}
                          disabled={!renameValue.trim()}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-themeblue2 active:scale-95 transition-all disabled:opacity-30"
                          aria-label="Confirm rename"
                        >
                          <Check size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleVisible(overlay.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                          isVisible ? 'text-themeblue2' : 'text-tertiary/50'
                        }`}
                        title={isVisible ? 'Hide on map' : 'Show on map'}
                        aria-label={isVisible ? 'Hide on map' : 'Show on map'}
                      >
                        {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Features */}
                {hasChildren && !isCollapsed && overlay.features.map((feature) => {
                  const isSelected = selectedFeatureId === feature.id && isActive;
                  return (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => onSelectFeature(feature, overlay.id)}
                      className={`w-full flex items-center py-1.5 pr-3 text-left transition-colors ${
                        isSelected ? 'bg-themeblue3/10' : 'hover:bg-secondary/5'
                      }`}
                      style={{ paddingLeft: '46px' }}
                    >
                      <span className="text-[10pt] text-primary truncate flex-1">
                        {feature.label || `Untitled ${feature.type}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {contextMenu && (() => {
        const overlay = overlays.find(o => o.id === contextMenu.overlayId);
        if (!overlay) return null;
        const isCached = tileMeta.has(overlay.id);
        const isDownloading = downloadingId === overlay.id;
        const noFeatures = overlay.features.length === 0;
        const cacheBusy = downloadingId !== null && !isDownloading;
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              { key: 'rename', label: 'Rename', icon: Pencil, onAction: () => startRename(overlay) },
              isCached
                ? { key: 'evict', label: 'Remove offline tiles', icon: X, onAction: () => onEvictTiles(overlay.id) }
                : {
                    key: 'download',
                    label: isDownloading ? 'Downloading…' : 'Download offline tiles',
                    icon: isDownloading ? Loader2 : ArrowDownToLine,
                    disabled: isDownloading || noFeatures || cacheBusy,
                    onAction: () => onDownloadTiles(overlay),
                  },
              { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteOverlay(overlay.id) },
            ]}
          />
        );
      })()}
    </div>
  );
}
