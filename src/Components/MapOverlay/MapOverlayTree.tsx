import { useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Pencil, Trash2, X, Check, ArrowDownToLine, Wifi, Loader2, Plus, CalendarClock, Link2, Link2Off, MessageSquare, MoreHorizontal } from 'lucide-react';
import { LiftedRowMenu } from '../LiftedRowMenu';
import type { ContextMenuItem } from '../ContextMenu';
import { EmptyState } from '../EmptyState';
import { useLongPress } from '../../Hooks/useLongPress';
import { useShareToChat } from '../Messages/ShareToChatPicker';
import type { LocalMapOverlay, OverlayFeature } from '../../Types/MapOverlayTypes';
import type { TileMetadata } from '../../lib/mapTileService';

interface OverlayRowProps {
  overlayId: string;
  className: string;
  style?: React.CSSProperties;
  dataTour?: string;
  /** Open the lifted menu anchored to this row's bounding rect (conversation pattern). */
  onOpenMenu: (rect: DOMRect) => void;
  children: React.ReactNode;
}

function OverlayRow({ overlayId, className, style, dataTour, onOpenMenu, children }: OverlayRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const openFromRow = useCallback(() => {
    if (rowRef.current) onOpenMenu(rowRef.current.getBoundingClientRect());
  }, [onOpenMenu]);
  const { isPressing, ...longPressHandlers } = useLongPress(() => openFromRow());
  return (
    <div
      ref={rowRef}
      data-overlay-row={overlayId}
      data-tour={dataTour}
      className={`${className} ${isPressing ? 'opacity-60' : ''}`}
      style={style}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openFromRow();
      }}
      {...longPressHandlers}
    >
      {children}
    </div>
  );
}

interface FeatureRowProps {
  featureId: string;
  className: string;
  style?: React.CSSProperties;
  dataTour?: string;
  /** Open the lifted menu anchored to this row's bounding rect (conversation pattern). */
  onOpenMenu: (rect: DOMRect) => void;
  onClick: () => void;
  children: React.ReactNode;
}

function FeatureRow({ featureId, className, style, dataTour, onOpenMenu, onClick, children }: FeatureRowProps) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const openFromRow = useCallback(() => {
    if (rowRef.current) onOpenMenu(rowRef.current.getBoundingClientRect());
  }, [onOpenMenu]);
  const { isPressing, ...longPressHandlers } = useLongPress(() => openFromRow());
  return (
    <button
      ref={rowRef}
      type="button"
      data-feature-row={featureId}
      data-tour={dataTour}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openFromRow();
      }}
      {...longPressHandlers}
      className={`${className} ${isPressing ? 'opacity-60' : ''}`}
      style={style}
    >
      {children}
    </button>
  );
}

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
  onNewOverlay: () => void;
  tileMeta: Map<string, TileMetadata>;
  downloadingId: string | null;
  onDownloadTiles: (overlay: LocalMapOverlay) => void;
  onEvictTiles: (overlayId: string) => void;
  /** Overlay-ids that have at least one CalendarEvent referencing them. Drives the link chip. */
  linkedOverlayIds: Set<string>;
  /** Open the calendar focused on the (or first) event linked to this overlay. */
  onJumpToLinkedEvent: (overlayId: string) => void;
  /** Open the event picker to link this overlay to an event. */
  onOpenLinkPicker: (overlayId: string, anchor: HTMLElement) => void;
  /** Unlink the overlay from its currently-linked event(s). */
  onUnlinkEvent: (overlayId: string) => void;
  /** Open the multi-pick events editor for the new N:N linked_overlays array. */
  onOpenLinksEditor: (overlayId: string, anchor: HTMLElement) => void;
  /** Open the multi-pick events editor for a single feature (linked_features N:N). */
  onOpenFeatureLinksEditor: (overlayId: string, featureId: string, anchor: HTMLElement) => void;
  /** Delete a single feature from its overlay. */
  onDeleteFeature: (overlayId: string, featureId: string) => void;
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
  onNewOverlay,
  tileMeta,
  downloadingId,
  onDownloadTiles,
  onEvictTiles,
  linkedOverlayIds,
  onJumpToLinkedEvent,
  onOpenLinkPicker,
  onUnlinkEvent,
  onOpenLinksEditor,
  onOpenFeatureLinksEditor,
  onDeleteFeature,
}: MapOverlayTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ overlayId: string; rect: DOMRect; row: ReactNode } | null>(null);
  const [featureContextMenu, setFeatureContextMenu] = useState<{ overlayId: string; featureId: string; rect: DOMRect; row: ReactNode } | null>(null);

  // The tree renders inside the overlay Sheet (body portal at z-1200); bump the
  // picker above it so it isn't trapped underneath.
  const { share: shareToChat, picker: shareToChatPicker } = useShareToChat({ zIndex: 1300 });
  const shareOverlay = useCallback((overlay: LocalMapOverlay) => {
    const count = overlay.features?.length ?? 0;
    shareToChat({
      type: 'shared_ref',
      refKind: 'map-overlay',
      refId: overlay.id,
      label: overlay.name || 'Untitled overlay',
      subLabel: overlay.description || `${count} ${count === 1 ? 'feature' : 'features'}`,
    }, { kind: 'map-overlay', overlay });
  }, [shareToChat]);
  const shareFeature = useCallback((overlay: LocalMapOverlay, feature: OverlayFeature) => {
    shareToChat({
      type: 'shared_ref',
      refKind: 'map-overlay',
      refId: overlay.id,
      featureId: feature.id,
      label: feature.label || 'Waypoint',
      subLabel: overlay.name || 'Overlay',
    });
  }, [shareToChat]);

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
    <div data-tour="map-overlay-tree" className="flex flex-col h-full">
      {/* Tree body — empty state primitive, or populated list with corner action */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1 relative">
        {sorted.length === 0 ? (
          <EmptyState
            title="No overlays yet"
            bordered={false}
            action={{ icon: Plus, label: 'New overlay', onClick: () => onNewOverlay() }}
          />
        ) : (
          <>
            {sorted.map((overlay, overlayIdx) => {
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
                <OverlayRow
                  overlayId={overlay.id}
                  dataTour={overlayIdx === 0 ? 'map-overlay-row' : undefined}
                  className={`group flex items-center gap-1.5 py-2 pr-3 transition-colors ${
                    isActive
                      ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                      : 'hover:bg-secondary/5 border-l-2 border-l-transparent'
                  }`}
                  style={{ paddingLeft: '12px' }}
                  onOpenMenu={(rect) => setContextMenu({
                    overlayId: overlay.id,
                    rect,
                    row: (
                      <div className="flex items-center gap-1.5 py-2 pr-3 bg-themewhite" style={{ paddingLeft: '12px' }}>
                        <span className="w-[18px] shrink-0" />
                        <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{overlay.name || 'Untitled'}</span>
                        {isVisible
                          ? <Eye size={15} className="shrink-0 text-themeblue2" />
                          : <EyeOff size={15} className="shrink-0 text-tertiary/50" />}
                      </div>
                    ),
                  })}
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

                  {/* Linked-event chip — tap jumps to the calendar event */}
                  {!isRenaming && linkedOverlayIds.has(overlay.id) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onJumpToLinkedEvent(overlay.id); }}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-themeblue2 hover:bg-themeblue2/10 active:scale-95 transition-all"
                      aria-label="Open linked calendar event"
                      title="Open linked calendar event"
                    >
                      <CalendarClock size={13} />
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
                          className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                          aria-label="Cancel rename"
                        >
                          <X size={15} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={commitRename}
                          disabled={!renameValue.trim()}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-themeblue2 active:scale-95 transition-all disabled:opacity-30"
                          aria-label="Confirm rename"
                        >
                          <Check size={15} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          const rowEl = e.currentTarget.closest('[data-overlay-row]') as HTMLElement | null;
                          setContextMenu({
                            overlayId: overlay.id,
                            rect: (rowEl ?? e.currentTarget).getBoundingClientRect(),
                            row: (
                              <div className="flex items-center gap-1.5 py-2 pr-3 bg-themewhite" style={{ paddingLeft: '12px' }}>
                                <span className="w-[18px] shrink-0" />
                                <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{overlay.name || 'Untitled'}</span>
                                {isVisible
                                  ? <Eye size={15} className="shrink-0 text-themeblue2" />
                                  : <EyeOff size={15} className="shrink-0 text-tertiary/50" />}
                              </div>
                            ),
                          });
                        }}
                        data-tour={overlayIdx === 0 ? 'map-overlay-visibility' : undefined}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                        title="More actions"
                        aria-label="More actions"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    )}
                  </div>
                </OverlayRow>

                {/* Features */}
                {hasChildren && !isCollapsed && overlay.features.map((feature, featureIdx) => {
                  const isSelected = selectedFeatureId === feature.id && isActive;
                  return (
                    <FeatureRow
                      key={feature.id}
                      featureId={feature.id}
                      dataTour={overlayIdx === 0 && featureIdx === 0 ? 'map-feature-row' : undefined}
                      onClick={() => onSelectFeature(feature, overlay.id)}
                      onOpenMenu={(rect) => setFeatureContextMenu({
                        overlayId: overlay.id,
                        featureId: feature.id,
                        rect,
                        row: (
                          <div className="w-full flex items-center py-1.5 pr-3 bg-themewhite" style={{ paddingLeft: '46px' }}>
                            <span className="text-[10pt] text-primary truncate flex-1">
                              {feature.label || `Untitled ${feature.type}`}
                            </span>
                          </div>
                        ),
                      })}
                      className={`w-full flex items-center py-1.5 pr-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                          : 'hover:bg-secondary/5 border-l-2 border-l-transparent'
                      }`}
                      style={{ paddingLeft: '46px' }}
                    >
                      <span className="text-[10pt] text-primary truncate flex-1">
                        {feature.label || `Untitled ${feature.type}`}
                      </span>
                    </FeatureRow>
                  );
                })}
              </div>
            );
          })}
          </>
        )}
      </div>

      {contextMenu && (() => {
        const overlay = overlays.find(o => o.id === contextMenu.overlayId);
        if (!overlay) return null;
        const isCached = tileMeta.has(overlay.id);
        const isDownloading = downloadingId === overlay.id;
        const noFeatures = overlay.features.length === 0;
        const cacheBusy = downloadingId !== null && !isDownloading;
        const isLinked = linkedOverlayIds.has(overlay.id);
        const isVisible = visibleOverlayIds.has(overlay.id);
        const items: ContextMenuItem[] = [
              isVisible
                ? { key: 'visibility', label: 'Hide on map', icon: EyeOff, onAction: () => onToggleVisible(overlay.id) }
                : { key: 'visibility', label: 'View on map', icon: Eye, onAction: () => onToggleVisible(overlay.id) },
              { key: 'rename', label: 'Rename', icon: Pencil, onAction: () => startRename(overlay) },
              { key: 'share-to-chat', label: 'Share to chat', icon: MessageSquare, onAction: () => shareOverlay(overlay) },
              isLinked
                ? { key: 'unlink', label: 'Unlink event', icon: Link2Off, onAction: () => onUnlinkEvent(overlay.id) }
                : {
                    key: 'link',
                    label: 'Link to event…',
                    icon: Link2,
                    onAction: () => {
                      const row = document.querySelector<HTMLElement>(`[data-overlay-row="${overlay.id}"]`);
                      onOpenLinkPicker(overlay.id, row ?? document.body);
                    },
                  },
              {
                key: 'manage-links',
                label: 'Manage event links…',
                icon: Link2,
                onAction: () => {
                  const row = document.querySelector<HTMLElement>(`[data-overlay-row="${overlay.id}"]`);
                  onOpenLinksEditor(overlay.id, row ?? document.body);
                },
              },
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
        ];
        return (
          <LiftedRowMenu
            isOpen
            anchorRect={contextMenu.rect}
            row={contextMenu.row}
            items={items}
            onClose={() => setContextMenu(null)}
            layout="list"
          />
        );
      })()}

      {featureContextMenu && (() => {
        const overlay = overlays.find(o => o.id === featureContextMenu.overlayId);
        const feature = overlay?.features.find(f => f.id === featureContextMenu.featureId);
        if (!overlay || !feature) return null;
        const items: ContextMenuItem[] = [
              { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onSelectFeature(feature, overlay.id) },
              { key: 'share-to-chat', label: 'Share to chat', icon: MessageSquare, onAction: () => shareFeature(overlay, feature) },
              {
                key: 'manage-links',
                label: 'Manage event links…',
                icon: Link2,
                onAction: () => {
                  const row = document.querySelector<HTMLElement>(`[data-feature-row="${feature.id}"]`);
                  onOpenFeatureLinksEditor(overlay.id, feature.id, row ?? document.body);
                },
              },
              { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteFeature(overlay.id, feature.id) },
        ];
        return (
          <LiftedRowMenu
            isOpen
            anchorRect={featureContextMenu.rect}
            row={featureContextMenu.row}
            items={items}
            onClose={() => setFeatureContextMenu(null)}
            layout="list"
          />
        );
      })()}

      {shareToChatPicker}
    </div>
  );
}
