import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, Camera, Trash2, ClipboardList, Link2, Link2Off, ExternalLink } from 'lucide-react';
import { forward } from 'mgrs';
import type { OverlayFeature, WaypointType } from '../../Types/MapOverlayTypes';
import { TACTICAL_COLORS, WAYPOINT_LABELS, WAYPOINT_CATEGORIES } from '../../Types/MapOverlayTypes';
import { WaypointIcon } from './WaypointIcon';
import { useMapPrefsStore } from '../../stores/useMapPrefsStore';
import { formatBearing } from '../../lib/declination';
import { putPhoto, getPhoto, deletePhoto } from '../../lib/mapPhotoService';
import { useTC3Store } from '../../stores/useTC3Store';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMedevacStore } from '../../stores/useMedevacStore';
import { buildMedevacFromPin } from '../../lib/medevacFromPin';
import { MedevacForm } from '../Medevac/MedevacForm';
import { Modal } from '../Modal';
import { Siren, FileDown as FileDownStripMap } from 'lucide-react';
import { computeLegs, type Pace } from '../../lib/stripMap/computeLegs';
import { generateStripMapPdf } from '../../lib/stripMap/generatePdf';
import { downloadPdfBytes } from '../../Utilities/downloadUtils';


interface FeatureEditorProps {
  feature: OverlayFeature;
  onUpdate: (updated: OverlayFeature) => void;
  /** Other waypoints in the same overlay — used to label route legs that end on a waypoint. */
  waypoints?: OverlayFeature[];
  /** Called when a route leg row is tapped — receives bbox `[west, south, east, north]` of that leg's two endpoints. */
  onFocusLeg?: (bbox: [number, number, number, number]) => void;
}

const WAYPOINT_SNAP_M = 15; // legs that end within this distance of a waypoint borrow its label

function computeMgrs(geometry: [number, number][], precision = 5): string {
  if (geometry.length === 0) return '';
  const [lat, lng] = geometry[0];
  try {
    return forward([lng, lat], precision);
  } catch {
    return 'Invalid';
  }
}

function legGeometry(lat1: number, lng1: number, lat2: number, lng2: number): { distanceM: number; bearing: number } {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { distanceM, bearing };
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function nearestWaypointLabel(
  lat: number,
  lng: number,
  waypoints: OverlayFeature[],
  selfId: string,
): string | null {
  let best: { label: string; d: number } | null = null;
  for (const w of waypoints) {
    if (w.id === selfId || w.geometry.length === 0) continue;
    const [wLat, wLng] = w.geometry[0];
    const { distanceM } = legGeometry(lat, lng, wLat, wLng);
    if (distanceM <= WAYPOINT_SNAP_M && (!best || distanceM < best.d)) {
      best = { label: w.label || 'Waypoint', d: distanceM };
    }
  }
  return best ? best.label : null;
}

export function FeatureEditor({ feature, onUpdate, waypoints = [], onFocusLeg }: FeatureEditorProps) {
  const [copied, setCopied] = useState(false);
  const bearingReference = useMapPrefsStore(s => s.bearingReference);
  // Phase 4.1 — TC3 link integration. We subscribe with selectors so the
  // editor reactively shows the right state when the active card or queue
  // changes while the editor is open.
  const tc3ActiveCard = useTC3Store(s => s.card);
  const tc3Queue = useTC3Store(s => s.casualtyQueue);
  const tc3Restore = useTC3Store(s => s.restoreFromQueue);

  const linkedId = feature.tc3_card_id;
  const linkedIsActive = !!linkedId && tc3ActiveCard?.id === linkedId;
  const linkedIsQueued = !!linkedId && tc3Queue.some(q => q.card.id === linkedId);
  const linkedExists = linkedIsActive || linkedIsQueued;
  const hasActiveCard = !!tc3ActiveCard?.id;
  const activeAlreadyLinked = hasActiveCard && linkedId === tc3ActiveCard!.id;

  const handleLinkActive = useCallback(() => {
    if (!hasActiveCard) return;
    onUpdate({ ...feature, tc3_card_id: tc3ActiveCard!.id, updated_at: new Date().toISOString() });
  }, [feature, hasActiveCard, tc3ActiveCard, onUpdate]);

  const handleUnlink = useCallback(() => {
    onUpdate({ ...feature, tc3_card_id: undefined, updated_at: new Date().toISOString() });
  }, [feature, onUpdate]);

  const handleOpenTC3 = useCallback(() => {
    if (!linkedId) return;
    if (linkedIsQueued && !linkedIsActive) tc3Restore(linkedId);
    // Flip the app into TC3 mode — same path as the menu toggle.
    useAuthStore.getState().patchProfile({ tc3Mode: true });
  }, [linkedId, linkedIsActive, linkedIsQueued, tc3Restore]);

  // Phase 4.2 — Build MEDEVAC from this pin. Pre-populates the MEDEVAC store
  // with line 1 (pickup grid in MGRS), the cross-domain link fields, and any
  // tc3CardId carried by the pin. Editor opens in a Modal.
  const medevacReq = useMedevacStore(s => s.req);
  const setMedevacReq = useMedevacStore(s => s.setReq);
  const [medevacOpen, setMedevacOpen] = useState(false);
  const [medevacBuildError, setMedevacBuildError] = useState<string | null>(null);

  const showMedevacAction = feature.type === 'waypoint'
    && feature.geometry.length > 0
    && (feature.waypoint_type === 'pz' || feature.waypoint_type === 'lz' || !!feature.tc3_card_id);

  const handleBuildMedevac = useCallback(() => {
    setMedevacBuildError(null);
    const result = buildMedevacFromPin(feature, { overlayId: feature.overlay_id, base: medevacReq });
    if (result.error) {
      setMedevacBuildError(result.error);
      return;
    }
    setMedevacReq(result.req);
    setMedevacOpen(true);
  }, [feature, medevacReq, setMedevacReq]);

  const handleMedevacChange = useCallback((next: typeof medevacReq) => {
    setMedevacReq(next);
  }, [setMedevacReq]);

  // Phase 4.4 — Strip-map PDF export. Pace selector lives next to the
  // export button so the user can produce different timing variants
  // (commander wants 100m/min; foot element wants 80m/min) without re-
  // visiting any global setting.
  const [stripPace, setStripPace] = useState<Pace>('100');
  const [stripExporting, setStripExporting] = useState(false);

  const handleExportStripMap = useCallback(async () => {
    if (feature.type !== 'route' || feature.geometry.length < 2) return;
    setStripExporting(true);
    try {
      const data = computeLegs({
        overlayName: 'Overlay',
        route: feature,
        waypoints,
        bearingReference,
        pace: stripPace,
      });
      const bytes = await generateStripMapPdf(data);
      const safeName = (feature.label || 'route').replace(/[^\w\-]+/g, '_');
      downloadPdfBytes(bytes, `strip-map-${safeName}.pdf`);
    } finally {
      setStripExporting(false);
    }
  }, [feature, waypoints, bearingReference, stripPace]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Load attached photo (device-only — see mapPhotoService) when the feature
  // changes. Object URL is revoked on cleanup to avoid leaks.
  useEffect(() => {
    if (feature.type !== 'waypoint') {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    getPhoto(feature.id).then(p => {
      if (cancelled || !p) { setPhotoUrl(null); return; }
      url = URL.createObjectURL(p.blob);
      setPhotoUrl(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [feature.id, feature.type]);

  const handlePhotoPick = useCallback(() => photoInputRef.current?.click(), []);

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setPhotoError(null);
    if (!file) return;
    const result = await putPhoto(feature.id, file, file.name);
    if (!result.ok) {
      setPhotoError(result.error.message);
      return;
    }
    // Refresh the displayed thumbnail.
    const fresh = await getPhoto(feature.id);
    if (fresh) {
      setPhotoUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(fresh.blob);
      });
    }
  }, [feature.id]);

  const handlePhotoRemove = useCallback(async () => {
    await deletePhoto(feature.id);
    setPhotoUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [feature.id]);

  const mgrs = useMemo(() => computeMgrs(feature.geometry), [feature.geometry]);

  // Resolve a route vertex to either a snapped waypoint label or its 8-digit
  // MGRS grid. 8-digit (~10 m precision) is the readable middle ground for
  // tactical comms — short enough to read aloud, accurate enough to navigate.
  const labelForPoint = useCallback((lat: number, lng: number): { label: string; isWaypoint: boolean } => {
    const wpt = nearestWaypointLabel(lat, lng, waypoints, feature.id);
    if (wpt) return { label: wpt, isWaypoint: true };
    return { label: computeMgrs([[lat, lng]], 4), isWaypoint: false };
  }, [waypoints, feature.id]);

  // Turn-by-turn legs for routes — each segment carries its endpoints so a
  // tap can fitBounds back into the parent map.
  const legs = useMemo(() => {
    if (feature.type !== 'route' || feature.geometry.length < 2) return [];
    const out: {
      distanceM: number;
      bearing: number;
      start: [number, number];
      end: [number, number];
      endLabel: string;
      isWaypoint: boolean;
    }[] = [];
    for (let i = 0; i < feature.geometry.length - 1; i++) {
      const [lat1, lng1] = feature.geometry[i];
      const [lat2, lng2] = feature.geometry[i + 1];
      const { distanceM, bearing } = legGeometry(lat1, lng1, lat2, lng2);
      const { label, isWaypoint } = labelForPoint(lat2, lng2);
      out.push({ distanceM, bearing, start: [lat1, lng1], end: [lat2, lng2], endLabel: label, isWaypoint });
    }
    return out;
  }, [feature.geometry, feature.type, labelForPoint]);

  const totalDistanceM = useMemo(() => legs.reduce((sum, l) => sum + l.distanceM, 0), [legs]);

  const startLabel = useMemo(() => {
    if (feature.type !== 'route' || feature.geometry.length === 0) return null;
    const [lat, lng] = feature.geometry[0];
    return labelForPoint(lat, lng);
  }, [feature.geometry, feature.type, labelForPoint]);

  const endLabel = useMemo(() => {
    if (feature.type !== 'route' || feature.geometry.length < 2) return null;
    const [lat, lng] = feature.geometry[feature.geometry.length - 1];
    return labelForPoint(lat, lng);
  }, [feature.geometry, feature.type, labelForPoint]);

  const handleFocusLeg = useCallback((start: [number, number], end: [number, number]) => {
    if (!onFocusLeg) return;
    const west = Math.min(start[1], end[1]);
    const east = Math.max(start[1], end[1]);
    const south = Math.min(start[0], end[0]);
    const north = Math.max(start[0], end[0]);
    onFocusLeg([west, south, east, north]);
  }, [onFocusLeg]);

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
    <div className="flex flex-col">
      {/* Waypoint MGRS — copy affordance. Routes/areas surface grids in their
          directions section, so the bare MGRS row only renders for waypoints. */}
      {feature.type === 'waypoint' && (
        <div className="px-3 py-2 border-b border-primary/6">
          <button
            type="button"
            onClick={handleCopyMgrs}
            className="flex items-center gap-2 w-full text-[10pt] text-tertiary font-mono active:scale-95 transition-all"
          >
            <span className="flex-1 text-left truncate">{mgrs || 'N/A'}</span>
            {copied ? (
              <Check size={12} className="text-themegreen shrink-0" />
            ) : (
              <Copy size={12} className="text-tertiary shrink-0" />
            )}
          </button>
        </div>
      )}

      {/* Waypoint glyph picker — categorized */}
      {feature.type === 'waypoint' && (
        <div className="px-3 py-2 border-b border-primary/6 flex flex-col gap-2">
          {WAYPOINT_CATEGORIES.map(cat => (
            <div key={cat.id} className="flex flex-col gap-1">
              <span className="text-[9pt] font-medium text-tertiary uppercase tracking-wide">{cat.label}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {cat.types.map(wt => {
                  const active = (feature.waypoint_type ?? 'circle') === wt;
                  return (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => handleWaypointTypeChange(wt)}
                      aria-label={WAYPOINT_LABELS[wt]}
                      title={WAYPOINT_LABELS[wt]}
                      className={`w-8 h-8 rounded-md flex items-center justify-center active:scale-95 transition-all ${active ? 'bg-primary/10 ring-1 ring-primary/30' : 'opacity-60 hover:opacity-100'}`}
                    >
                      <WaypointIcon type={wt} color={feature.style.color} size={22} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo (waypoints only) — DEVICE-ONLY, never synced. */}
      {feature.type === 'waypoint' && (
        <div className="px-3 py-2 border-b border-primary/6 flex items-center gap-3">
          {photoUrl ? (
            <>
              <img
                src={photoUrl}
                alt="Waypoint"
                className="w-14 h-14 rounded-md object-cover border border-tertiary/20"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10pt] font-medium text-primary">Photo attached</p>
                <p className="text-[9pt] text-tertiary">Stored on this device only</p>
              </div>
              <button
                type="button"
                onClick={handlePhotoRemove}
                aria-label="Remove photo"
                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
              >
                <Trash2 size={15} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePhotoPick}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[10pt] font-medium text-tertiary hover:text-primary active:scale-95 transition-all"
            >
              <Camera size={14} />
              Attach photo
              <span className="text-[9pt] text-tertiary/70">· device only</span>
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {photoError && (
            <span className="text-[9pt] text-themeredred">{photoError}</span>
          )}
        </div>
      )}

      {/* Build MEDEVAC — surfaced for PZ/LZ pins or any pin with a TC3 link. */}
      {showMedevacAction && (
        <div className="px-3 py-2 border-b border-primary/6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-themewhite flex items-center justify-center text-themeredred shrink-0">
            <Siren size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10pt] font-medium text-primary">9-line MEDEVAC</p>
            <p className="text-[9pt] text-tertiary">
              Pre-fills line 1 (pickup grid) from this pin{feature.tc3_card_id ? ' and links the casualty card' : ''}.
            </p>
            {medevacBuildError && (
              <p className="text-[9pt] text-themeredred mt-0.5">{medevacBuildError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleBuildMedevac}
            className="shrink-0 px-3 py-1.5 rounded-md text-[10pt] font-medium text-themewhite bg-themeredred active:scale-95 transition-all"
          >
            Build
          </button>
        </div>
      )}

      <Modal
        isOpen={medevacOpen}
        onClose={() => setMedevacOpen(false)}
        title="9-line MEDEVAC"
        maxWidth={760}
      >
        <div className="p-2">
          <MedevacForm value={medevacReq} onChange={handleMedevacChange} />
        </div>
      </Modal>

      {/* TC3 link (waypoints only) — opaque id; no PHI in the OverlayFeature. */}
      {feature.type === 'waypoint' && (
        <div className="px-3 py-2 border-b border-primary/6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-themewhite flex items-center justify-center text-themeredred shrink-0">
            <ClipboardList size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10pt] font-medium text-primary">
              {linkedExists
                ? linkedIsActive ? 'Linked · active TC3 card' : 'Linked · queued TC3 card'
                : linkedId ? 'Linked · card no longer available' : 'No casualty card linked'}
            </p>
            <p className="text-[9pt] text-tertiary">
              {linkedExists
                ? 'Tap to open the casualty card. The link is an opaque id — no PHI on the map.'
                : hasActiveCard
                  ? 'Link this pin to the active TC3 card.'
                  : 'Open a TC3 card first to link.'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {linkedExists && (
              <button
                type="button"
                onClick={handleOpenTC3}
                aria-label="Open TC3 card"
                title="Open TC3 card"
                className="w-8 h-8 rounded-full flex items-center justify-center text-themewhite bg-themeblue3 active:scale-95 transition-all"
              >
                <ExternalLink size={14} />
              </button>
            )}
            {!linkedId && hasActiveCard && (
              <button
                type="button"
                onClick={handleLinkActive}
                aria-label="Link active casualty"
                title="Link active casualty"
                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-themeblue3 active:scale-95 transition-all"
              >
                <Link2 size={14} />
              </button>
            )}
            {linkedId && (
              <button
                type="button"
                onClick={handleUnlink}
                aria-label="Unlink"
                title="Unlink"
                className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all ${linkedExists ? 'text-tertiary hover:text-themeredred' : 'text-themeredred'}`}
              >
                <Link2Off size={14} />
              </button>
            )}
            {hasActiveCard && linkedId && !activeAlreadyLinked && (
              <button
                type="button"
                onClick={handleLinkActive}
                aria-label="Link active casualty (replace)"
                title="Link active casualty (replace)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-themeblue3 active:scale-95 transition-all"
              >
                <Link2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Color Picker */}
      <div className="px-3 py-2 border-b border-primary/6 flex items-center gap-2">
        {TACTICAL_COLORS.map((tc) => {
          const active = feature.style.color === tc.hex;
          return (
            <button
              key={tc.hex}
              type="button"
              onClick={() => handleColorChange(tc.hex)}
              className={`w-6 h-6 rounded-full active:scale-95 transition-all ${active ? 'ring-2 ring-offset-1 ring-primary/40' : 'opacity-70 hover:opacity-100'}`}
              style={{ backgroundColor: tc.hex }}
              aria-label={tc.name}
            />
          );
        })}
      </div>

      {/* Directions — routes only. Start point at top, one row per leg
          (distance · bearing · 8-digit grid or waypoint name), end point and
          total at the bottom. Tapping a leg fits the map to that segment. */}
      {feature.type === 'route' && legs.length > 0 && startLabel && endLabel && (
        <div className="px-3 py-2 border-b border-primary/6 flex flex-col gap-1.5">
          <div className={`text-[10pt] ${startLabel.isWaypoint ? 'text-themeblue2 font-medium' : 'font-mono text-primary'}`}>
            {startLabel.label}
          </div>
          <ul className="flex flex-col gap-1">
            {legs.map((leg, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleFocusLeg(leg.start, leg.end)}
                  className="w-full flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left px-2 py-1 -mx-2 rounded-md hover:bg-themewhite3/40 active:scale-[0.99] transition-all"
                >
                  <span className="font-mono tabular-nums text-[10pt] text-primary">{formatDistance(leg.distanceM)}</span>
                  <span className="font-mono tabular-nums text-[10pt] text-primary">{formatBearing(leg.bearing, bearingReference, (leg.start[0] + leg.end[0]) / 2, (leg.start[1] + leg.end[1]) / 2)}</span>
                  <span className={`text-[10pt] ${leg.isWaypoint ? 'text-themeblue2 font-medium' : 'font-mono text-primary'}`}>
                    {leg.endLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="pt-1 border-t border-primary/6 flex items-center justify-between gap-2">
            <span className={`text-[10pt] truncate ${endLabel.isWaypoint ? 'text-themeblue2 font-medium' : 'font-mono text-primary'}`}>
              {endLabel.label}
            </span>
            <span className="text-[10pt] font-mono tabular-nums text-tertiary shrink-0">
              {formatDistance(totalDistanceM)}
            </span>
          </div>

          {/* Phase 4.4 — Export strip map PDF */}
          <div className="pt-2 mt-1 border-t border-primary/6 flex items-center gap-2">
            <span className="text-[9pt] font-medium text-tertiary uppercase tracking-wide shrink-0">Pace</span>
            <div className="flex rounded-md bg-themewhite p-0.5">
              {([
                { v: 'off' as const, label: 'Off' },
                { v: '100' as const, label: '100' },
                { v: '80' as const, label: '80' },
              ]).map(({ v, label }) => {
                const active = stripPace === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStripPace(v)}
                    className={`px-2 py-1 rounded text-[10pt] font-medium transition-colors ${active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleExportStripMap}
              disabled={stripExporting}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10pt] font-medium text-themewhite bg-themeblue3 disabled:opacity-50 active:scale-95 transition-all"
              title="Export strip-map PDF"
            >
              <FileDownStripMap size={13} />
              {stripExporting ? 'Building…' : 'Strip map'}
            </button>
          </div>
        </div>
      )}

      {/* Notes */}
      <textarea
        value={feature.notes ?? ''}
        onChange={(e) => handleNotesChange(e.target.value)}
        rows={3}
        placeholder="Notes"
        className="w-full px-3 py-2 bg-transparent text-[10pt] text-primary placeholder:text-tertiary resize-none focus:outline-none"
      />
    </div>
  );
}
