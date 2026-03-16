import { useState, useMemo, useCallback } from 'react';
import { Map, Trash2, Plus, MapPin, Route as RouteIcon } from 'lucide-react';
import type { MapOverlay } from '../../Types/MapOverlayTypes';
import { SearchInput } from '../SearchInput';
import { EmptyState } from '../EmptyState';

interface OverlayListProps {
  overlays: MapOverlay[];
  onSelect: (overlay: MapOverlay) => void;
  onDelete: (overlayId: string) => void;
  onNewOverlay: () => void;
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

export function OverlayList({ overlays, onSelect, onDelete, onNewOverlay }: OverlayListProps) {
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

  if (overlays.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <EmptyState
          icon={<Map size={40} />}
          title="No Overlays"
          subtitle="Create a new overlay to plot waypoints and routes"
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
            subtitle="Try a different search term"
            className="py-12"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((overlay) => (
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

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, overlay.id)}
                    className="p-2 rounded-lg hover:bg-themeredred/10 active:scale-95 transition-all duration-300 shrink-0"
                    aria-label={`Delete ${overlay.name}`}
                  >
                    <Trash2 size={16} className="text-themeredred" />
                  </button>
                </div>
              </button>
            ))}
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
