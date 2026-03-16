import { useState, useMemo, useCallback } from 'react';
import { X, Trash2, Copy, Check } from 'lucide-react';
import { forward } from 'mgrs';
import type { OverlayFeature, WaypointType, FeatureType } from '../../Types/MapOverlayTypes';
import { WAYPOINT_LABELS, TACTICAL_COLORS } from '../../Types/MapOverlayTypes';

interface FeatureEditorProps {
  feature: OverlayFeature;
  onUpdate: (updated: OverlayFeature) => void;
  onDelete: () => void;
  onClose: () => void;
}

const WAYPOINT_TYPES = Object.keys(WAYPOINT_LABELS) as WaypointType[];

function computeMgrs(geometry: [number, number][]): string {
  if (geometry.length === 0) return '';
  const [lat, lng] = geometry[0];
  try {
    return forward([lng, lat], 5);
  } catch {
    return 'Invalid';
  }
}

export function FeatureEditor({ feature, onUpdate, onDelete, onClose }: FeatureEditorProps) {
  const [copied, setCopied] = useState(false);

  const mgrs = useMemo(() => computeMgrs(feature.geometry), [feature.geometry]);

  const handleLabelChange = useCallback((label: string) => {
    onUpdate({ ...feature, label, updated_at: new Date().toISOString() });
  }, [feature, onUpdate]);

  const handleWaypointTypeChange = useCallback((waypointType: WaypointType) => {
    onUpdate({ ...feature, waypoint_type: waypointType, updated_at: new Date().toISOString() });
  }, [feature, onUpdate]);

  const handleColorChange = useCallback((color: string) => {
    onUpdate({
      ...feature,
      style: { ...feature.style, color },
      updated_at: new Date().toISOString(),
    });
  }, [feature, onUpdate]);

  const handleNotesChange = useCallback((notes: string) => {
    onUpdate({ ...feature, notes, updated_at: new Date().toISOString() });
  }, [feature, onUpdate]);

  const handleCopyMgrs = useCallback(async () => {
    if (!mgrs || mgrs === 'Invalid') return;
    try {
      await navigator.clipboard.writeText(mgrs);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  }, [mgrs]);

  return (
    <>
      <div
        className="absolute inset-0 z-[1000]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute bottom-0 left-0 right-0 z-[1001] bg-themewhite dark:bg-themegray rounded-t-2xl shadow-2xl
        max-h-[50vh] overflow-y-auto transition-transform duration-300 animate-slide-up"
      >
        <div className="sticky top-0 bg-themewhite dark:bg-themegray z-10">
          <div className="w-10 h-1 bg-tertiary/30 rounded-full mx-auto my-2" />
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-sm font-semibold text-primary capitalize">
              {feature.type} Details
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
              aria-label="Close editor"
            >
              <X size={18} className="text-tertiary" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-6 flex flex-col gap-4">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Label</label>
            <input
              type="text"
              value={feature.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2
                text-sm text-primary focus:border-themeblue2 focus:outline-none transition-all duration-300"
            />
          </div>

          {/* Waypoint Type Picker */}
          {feature.type === 'waypoint' && (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Waypoint Type</label>
              <div className="grid grid-cols-5 gap-1.5">
                {WAYPOINT_TYPES.map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => handleWaypointTypeChange(wt)}
                    className={`px-2 py-1.5 rounded-md text-xs font-medium active:scale-95 transition-all duration-300
                      ${feature.waypoint_type === wt
                        ? 'bg-themeblue3 text-white'
                        : 'bg-themewhite2 text-secondary hover:bg-themewhite2/80'
                      }`}
                  >
                    {WAYPOINT_LABELS[wt]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Color</label>
            <div className="flex items-center gap-3">
              {TACTICAL_COLORS.map((tc) => (
                <button
                  key={tc.hex}
                  type="button"
                  onClick={() => handleColorChange(tc.hex)}
                  className={`w-8 h-8 rounded-full border border-tertiary/15 active:scale-95 transition-all duration-300
                    ${feature.style.color === tc.hex ? 'ring-2 ring-offset-2 ring-themeblue2' : ''}`}
                  style={{ backgroundColor: tc.hex }}
                  aria-label={tc.name}
                />
              ))}
            </div>
          </div>

          {/* MGRS Readout */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">MGRS</label>
            <button
              type="button"
              onClick={handleCopyMgrs}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-tertiary/15
                bg-themewhite2 text-sm text-primary font-mono active:scale-95 transition-all duration-300"
            >
              <span className="flex-1 text-left truncate">{mgrs || 'N/A'}</span>
              {copied ? (
                <Check size={14} className="text-themegreen shrink-0" />
              ) : (
                <Copy size={14} className="text-tertiary shrink-0" />
              )}
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Notes</label>
            <textarea
              value={feature.notes ?? ''}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2
                text-sm text-primary resize-none focus:border-themeblue2 focus:outline-none transition-all duration-300"
              placeholder="Add notes..."
            />
          </div>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl
              bg-themeredred text-white text-sm font-medium active:scale-95 transition-all duration-300"
          >
            <Trash2 size={16} />
            Delete Feature
          </button>
        </div>
      </div>
    </>
  );
}
