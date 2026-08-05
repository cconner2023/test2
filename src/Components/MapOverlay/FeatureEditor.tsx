import { useState, useMemo, useCallback, useEffect } from 'react';
import { Copy, ChevronDown, Spline, Hexagon, Navigation, Plus } from 'lucide-react';
import { floorLabel } from './FloorSelector';
import { latLngToMgrs } from '../../lib/mgrsFormat';
import { latLngToUTM } from './utmProjection';
import type { OverlayFeature, WaypointType } from '../../Types/MapOverlayTypes';
import { TACTICAL_COLORS, WAYPOINT_LABELS, PIN_GLYPHS } from '../../Types/MapOverlayTypes';
import { WaypointIcon } from './WaypointIcon';
import { useMapPrefsStore } from '../../stores/useMapPrefsStore';
import { formatBearing } from '../../lib/declination';
import { copyText } from '../../Utilities/clipboardUtils';
import { useTC3Store } from '../../stores/useTC3Store';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { useMedevacStore } from '../../stores/useMedevacStore';
import { buildMedevacFromPin } from '../../lib/medevacFromPin';
import { MedevacForm } from '../Medevac/MedevacForm';
import { Modal } from '@/Components/primitives/Modal';
import { Siren, FileDown as FileDownStripMap } from 'lucide-react';
import { computeLegs, type Pace } from '../../lib/stripMap/computeLegs';
import { generateStripMapPdf } from '../../lib/stripMap/generatePdf';
import { downloadPdfBytes } from '../../Utilities/downloadUtils';
import { TextInput, TextArea, PickerInput } from '@/Components/primitives/FormInputs';


interface FeatureEditorProps {
  feature: OverlayFeature;
  onUpdate: (updated: OverlayFeature) => void;
  /** Other waypoints in the same overlay — used to label route legs that end on a waypoint. */
  waypoints?: OverlayFeature[];
  /** Called when a route leg row is tapped — receives bbox `[west, south, east, north]` of that leg's two endpoints. */
  onFocusLeg?: (bbox: [number, number, number, number]) => void;
  /** Count of CalendarEvents linked to this feature (explicit + parent-overlay implied). Hidden when undefined. */
  linkedEventCount?: number;
  /** Open the per-feature event multi-pick popover anchored to the supplied element. */
  onOpenLinksEditor?: (anchor: HTMLElement) => void;
  /** When true, swap the body into form-edit chrome: TextInput for label,
   *  PickerInput-style rows for TC3 + linked events. Read mode shows
   *  informational rows and action affordances only. */
  isEditMode?: boolean;
  /** Distinct floor levels available in the overlay, ascending. When more than
   *  one floor exists (or onChangeFloor is given) a floor-reassign row shows in
   *  edit mode. */
  floors?: number[];
  /** Reassign this feature to a floor (0 = base). The parent also switches the
   *  active floor so the moved feature stays visible after the move. */
  onChangeFloor?: (level: number) => void;
}

const WAYPOINT_SNAP_M = 15; // legs that end within this distance of a waypoint borrow its label

function computeMgrs(geometry: [number, number][], precision = 5): string {
  if (geometry.length === 0) return '';
  const [lat, lng] = geometry[0];
  return latLngToMgrs(lat, lng, precision) || 'Invalid';
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

export function FeatureEditor({ feature, onUpdate, waypoints = [], onFocusLeg, linkedEventCount, onOpenLinksEditor, isEditMode = false, floors = [], onChangeFloor }: FeatureEditorProps) {
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
    // Open the TC3 drawer — same path as the menu item (closes the map drawer).
    useNavigationStore.getState().setShowTC3Drawer(true);
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

  const mgrs = useMemo(() => computeMgrs(feature.geometry), [feature.geometry]);

  // Info block (read mode) — UTM derived from the first vertex, same format as
  // MapView's detail overlay (`<zone><N|S> <easting> <northing>`, 7-digit zero
  // padded). For routes/areas this is the route/area's anchor point.
  const utm = useMemo(() => {
    if (feature.geometry.length === 0) return '';
    const [lat, lng] = feature.geometry[0];
    try {
      const u = latLngToUTM(lat, lng);
      const e = Math.round(u.easting).toString().padStart(7, '0');
      const n = Math.round(u.northing).toString().padStart(7, '0');
      return `${u.zone}${u.northern ? 'N' : 'S'} ${e} ${n}`;
    } catch { return ''; }
  }, [feature.geometry]);

  // Reverse-geocoded address for the read-mode info block. Fires only when
  // out of edit mode so vertex drags don't burn Nominatim hits; cleared and
  // re-fetched on feature/geometry change. Debounced 300ms.
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  useEffect(() => {
    if (isEditMode || feature.geometry.length === 0) {
      setAddress('');
      setAddressLoading(false);
      return;
    }
    const [lat, lng] = feature.geometry[0];
    let cancelled = false;
    setAddress('');
    setAddressLoading(true);
    const t = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'en' },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!cancelled) setAddress(d?.display_name ?? ''); })
        .catch(() => { if (!cancelled) setAddress(''); })
        .finally(() => { if (!cancelled) setAddressLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [feature.id, feature.geometry, isEditMode]);

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

  const handleLabelChange = useCallback((label: string) => {
    onUpdate({ ...feature, label, updated_at: new Date().toISOString() });
  }, [feature, onUpdate]);

  // Edit-mode TC3 selector — action-dispatch options bound to a PickerInput.
  // value stays '' so PickerInput always shows the status placeholder; each
  // option is an action ('link' / 'unlink' / 'open') routed in onChange.
  const tc3Options = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (hasActiveCard && !activeAlreadyLinked) opts.push({ value: 'link', label: 'Link active casualty card' });
    if (linkedId) opts.push({ value: 'unlink', label: 'Unlink' });
    if (linkedExists) opts.push({ value: 'open', label: 'Open in TC3' });
    return opts;
  }, [hasActiveCard, activeAlreadyLinked, linkedId, linkedExists]);

  const tc3StatusLabel = linkedExists
    ? linkedIsActive ? 'Linked · active card' : 'Linked · queued card'
    : linkedId ? 'Linked · card unavailable' : 'No casualty card linked';

  const handleTc3Action = useCallback((action: string) => {
    if (action === 'link') handleLinkActive();
    else if (action === 'unlink') handleUnlink();
    else if (action === 'open') handleOpenTC3();
  }, [handleLinkActive, handleUnlink, handleOpenTC3]);

  const handleCopyMgrs = useCallback(() => {
    if (!mgrs || mgrs === 'Invalid') return;
    void copyText(mgrs, 'MGRS copied');
  }, [mgrs]);

  // Directions deep-link for the feature anchor. The api=1 universal-link form
  // opens the Google Maps app when installed (iOS/Android) and otherwise falls
  // back to web Google Maps — works as a plain tappable <a> on iOS Safari.
  const mapsDirUrl = useMemo(() => {
    if (feature.geometry.length === 0) return '';
    const [lat, lng] = feature.geometry[0];
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }, [feature.geometry]);

  return (
    <div className="flex flex-col pb-[calc(env(safe-area-inset-bottom)+3rem)]">
      {/* Save/Cancel for the draft now live in the drawer/pane header pill
          cluster (see MapOverlayPanel) — the Pencil toggle swaps to Check + X
          while in edit mode. No in-body banner. */}
      {/* ─────────────────────────── EDIT MODE ───────────────────────────
          Form-field chrome: label TextInput, glyph picker, color picker,
          TC3 + linked-events PickerInput selectors, notes textarea.
          The title is hidden from the BaseDrawer header while in this mode
          (driven by the parent panel) so the input is the single source of
          truth for the feature name. */}
      {isEditMode && (
        <div className="rounded-2xl overflow-hidden">
          <TextInput
            value={feature.label ?? ''}
            onChange={handleLabelChange}
            placeholder={
              feature.type === 'waypoint' ? 'Waypoint name'
                : feature.type === 'route' ? 'Route name'
                : 'Area name'
            }
          />
        </div>
      )}

      {/* INFO BLOCK — READ mode. Compact identity card: feature glyph in the
          feature's color, MGRS (tap to copy), UTM, and reverse-geocoded
          address. Replaces the per-row action stack from the prior read view;
          actions (Navigate / Build MEDEVAC) now live in edit mode. */}
      {!isEditMode && (
        <div className="px-3 py-3 border-b border-primary/6 flex gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-themewhite flex items-center justify-center">
            {feature.type === 'waypoint' ? (
              <WaypointIcon type={feature.waypoint_type ?? 'circle'} color={feature.style.color} size={22} />
            ) : feature.type === 'route' ? (
              <Spline size={18} color={feature.style.color} />
            ) : (
              <Hexagon size={18} color={feature.style.color} />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <button
              type="button"
              onClick={handleCopyMgrs}
              className="flex items-center gap-2 w-full text-[10pt] text-primary font-mono active:scale-95 transition-all"
            >
              <span className="flex-1 text-left truncate">{mgrs || 'N/A'}</span>
              <Copy size={12} className="text-tertiary shrink-0" />
            </button>
            <div className="text-[10pt] text-primary font-mono truncate">{utm || '—'}</div>
            <div className="text-[9pt] text-tertiary truncate">
              {addressLoading ? 'Locating…' : (address || 'No address')}
            </div>
            {mapsDirUrl && (
              <div className="mt-1 flex items-center gap-4">
                <a
                  href={mapsDirUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[9pt] font-medium text-themeblue3 active:scale-95 transition-all"
                >
                  <Navigation size={12} /> Directions
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Waypoint glyph picker — EDIT mode only. Flat list mirroring the
          creation toolbar; not surfaced in read mode (the pin itself shows
          the current glyph on the map). */}
      {isEditMode && feature.type === 'waypoint' && (
        <div className="px-3 py-2 border-b border-primary/6 flex items-center gap-1.5 flex-wrap">
          {PIN_GLYPHS.map(wt => {
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
      )}

      {/* Build MEDEVAC — EDIT mode action (relocated from read view).
          Surfaced for PZ/LZ pins or any pin with a TC3 link. */}
      {isEditMode && showMedevacAction && (
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

      {/* TC3 link (waypoints only) — opaque id; no PHI in the OverlayFeature.
          EDIT mode: PickerInput selector — value stays empty so the placeholder
          carries the current status, and each option is an action dispatched
          through handleTc3Action ('link' / 'unlink' / 'open'). */}
      {isEditMode && feature.type === 'waypoint' && tc3Options.length > 0 && (
        <PickerInput
          value=""
          onChange={handleTc3Action}
          options={tc3Options}
          placeholder={tc3StatusLabel}
        />
      )}
      {isEditMode && feature.type === 'waypoint' && tc3Options.length === 0 && (
        <div className="block border-b border-primary/6 px-4 py-3 text-base md:text-sm text-tertiary">
          {tc3StatusLabel} · open a TC3 card to link
        </div>
      )}

      {/* Linked calendar events (N:N free-form). EDIT mode only — opens the
          existing OverlayEventPicker multi-pick via PickerInput-shaped row.
          Read mode hides this entirely. */}
      {onOpenLinksEditor && isEditMode && (
        <div className="block border-b border-primary/6 last:border-b-0">
          <button
            type="button"
            onClick={(e) => onOpenLinksEditor(e.currentTarget)}
            className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${linkedEventCount && linkedEventCount > 0 ? 'text-primary' : 'text-tertiary'}`}
          >
            <span className="truncate">
              {linkedEventCount && linkedEventCount > 0
                ? `Linked to ${linkedEventCount} event${linkedEventCount === 1 ? '' : 's'}`
                : 'Linked events'}
            </span>
            <ChevronDown size={16} className="shrink-0 text-tertiary" />
          </button>
        </div>
      )}
      {/* Color Picker — EDIT mode only. */}
      {isEditMode && (
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
      )}

      {/* Floor reassign — EDIT mode. Move this feature to another depth level.
          Shown only when the overlay actually has depth (>1 floor) so flat
          overlays stay uncluttered. "+" moves it to a brand-new floor. */}
      {isEditMode && onChangeFloor && floors.length > 1 && (
        <div className="px-3 py-2 border-b border-primary/6 flex items-center gap-2">
          <span className="text-[9pt] font-medium text-tertiary uppercase tracking-widest shrink-0">Floor</span>
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {floors.map((level) => {
              const active = (feature.level ?? 0) === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChangeFloor(level)}
                  className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-[10pt] font-semibold transition-all active:scale-95 ${active ? 'bg-themeblue3 text-white' : 'bg-themewhite text-tertiary hover:text-primary'}`}
                  aria-label={`Floor ${floorLabel(level)}`}
                  title={`Floor ${floorLabel(level)}`}
                >
                  {floorLabel(level)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onChangeFloor(Math.max(0, ...floors) + 1)}
              className="shrink-0 px-2 h-8 rounded-md flex items-center justify-center bg-themewhite text-tertiary hover:text-primary transition-all active:scale-95"
              aria-label="Move to new floor"
              title="Move to new floor"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Directions — READ mode, routes only. Start point at top, one row per
          leg (distance · bearing · 8-digit grid or waypoint name), end point
          and total at the bottom. Tapping a leg fits the map to that segment. */}
      {!isEditMode && feature.type === 'route' && legs.length > 0 && startLabel && endLabel && (
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
            <span className="text-[9pt] font-medium text-tertiary uppercase tracking-widest shrink-0">Pace</span>
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

      {/* Notes — editable in EDIT mode, read-only display in READ mode
          (hidden entirely when no notes exist and the user isn't editing). */}
      {isEditMode ? (
        <TextArea
          bare
          value={feature.notes ?? ''}
          onChange={handleNotesChange}
          rows={3}
          placeholder="Notes"
          inputClassName="w-full px-3 py-2 bg-transparent text-[10pt] text-primary placeholder:text-tertiary resize-none focus:outline-none"
        />
      ) : feature.notes ? (
        <div className="px-3 py-2 text-[10pt] text-primary whitespace-pre-wrap">
          {feature.notes}
        </div>
      ) : null}
    </div>
  );
}
