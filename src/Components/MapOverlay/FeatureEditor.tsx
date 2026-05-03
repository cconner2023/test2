import { useState, useMemo, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { forward } from 'mgrs';
import type { OverlayFeature, WaypointType } from '../../Types/MapOverlayTypes';
import { TACTICAL_COLORS, WAYPOINT_LABELS } from '../../Types/MapOverlayTypes';

const WAYPOINT_PICKER_TYPES: WaypointType[] = ['generic', 'hlz', 'ccp', 'casualty', 'contact'];

interface FeatureEditorProps {
  feature: OverlayFeature;
  onUpdate: (updated: OverlayFeature) => void;
}

function computeMgrs(geometry: [number, number][]): string {
  if (geometry.length === 0) return '';
  const [lat, lng] = geometry[0];
  try {
    return forward([lng, lat], 5);
  } catch {
    return 'Invalid';
  }
}

export function FeatureEditor({ feature, onUpdate }: FeatureEditorProps) {
  const [copied, setCopied] = useState(false);

  const mgrs = useMemo(() => computeMgrs(feature.geometry), [feature.geometry]);

  const handleLabelChange = useCallback((label: string) => {
    onUpdate({ ...feature, label, updated_at: new Date().toISOString() });
  }, [feature, onUpdate]);

  const handleColorChange = useCallback((color: string) => {
    onUpdate({
      ...feature,
      style: { ...feature.style, color },
      updated_at: new Date().toISOString(),
    });
  }, [feature, onUpdate]);

  const handleWaypointTypeChange = useCallback((waypoint_type: WaypointType) => {
    onUpdate({ ...feature, waypoint_type, updated_at: new Date().toISOString() });
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
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* Label */}
      <div>
        <label className="block text-[9pt] font-medium text-secondary mb-1">Label</label>
        <input
          type="text"
          value={feature.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-tertiary/15 bg-themewhite2
            text-[10pt] text-primary focus:border-themeblue2 focus:outline-none transition-all"
        />
      </div>

      {/* Waypoint Type — only on waypoints */}
      {feature.type === 'waypoint' && (
        <div>
          <label className="block text-[9pt] font-medium text-secondary mb-1">Type</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {WAYPOINT_PICKER_TYPES.map((wt) => (
              <button
                key={wt}
                type="button"
                onClick={() => handleWaypointTypeChange(wt)}
                className={`px-2 py-1 rounded-lg text-[9pt] font-medium active:scale-95 transition-all
                  ${(feature.waypoint_type ?? 'generic') === wt ? 'bg-themeblue3 text-white' : 'bg-themewhite2 text-tertiary'}`}
              >
                {WAYPOINT_LABELS[wt]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Picker */}
      <div>
        <label className="block text-[9pt] font-medium text-secondary mb-1">Color</label>
        <div className="flex items-center gap-1.5">
          {TACTICAL_COLORS.map((tc) => (
            <button
              key={tc.hex}
              type="button"
              onClick={() => handleColorChange(tc.hex)}
              className={`w-7 h-7 rounded-full border border-tertiary/15 active:scale-95 transition-all
                ${feature.style.color === tc.hex ? 'ring-2 ring-offset-1 ring-themeblue2' : ''}`}
              style={{ backgroundColor: tc.hex }}
              aria-label={tc.name}
            />
          ))}
        </div>
      </div>

      {/* MGRS Readout */}
      <div>
        <label className="block text-[9pt] font-medium text-secondary mb-1">MGRS</label>
        <button
          type="button"
          onClick={handleCopyMgrs}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg border border-tertiary/15
            bg-themewhite2 text-[10pt] text-primary font-mono active:scale-95 transition-all"
        >
          <span className="flex-1 text-left truncate">{mgrs || 'N/A'}</span>
          {copied ? (
            <Check size={12} className="text-themegreen shrink-0" />
          ) : (
            <Copy size={12} className="text-tertiary shrink-0" />
          )}
        </button>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[9pt] font-medium text-secondary mb-1">Notes</label>
        <textarea
          value={feature.notes ?? ''}
          onChange={(e) => handleNotesChange(e.target.value)}
          rows={3}
          className="w-full px-2.5 py-1.5 rounded-lg border border-tertiary/15 bg-themewhite2
            text-[10pt] text-primary resize-none focus:border-themeblue2 focus:outline-none transition-all"
          placeholder="Add notes..."
        />
      </div>
    </div>
  );
}
