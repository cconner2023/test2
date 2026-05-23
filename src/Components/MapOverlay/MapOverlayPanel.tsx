import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CalendarEvent } from '../../Types/CalendarTypes';
import { useSpring, animated } from '@react-spring/web';
import { ChevronLeft, ChevronRight, Settings, MapPin, Route, Pentagon, Trash2, X, Ruler, RadioTower, Undo2, Activity, Pause, Play, Square, Plus, Check, Navigation, Layers, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ActionSheet, type ActionSheetOption } from '../ActionSheet';
import { ActionPill } from '../ActionPill';
import { ConfirmDialog } from '../ConfirmDialog';

function waypointGlyphIcon(type: WaypointType): LucideIcon {
  return ((props: { size?: number }) => (
    <WaypointIcon type={type} color="currentColor" size={props.size ?? 16} />
  )) as unknown as LucideIcon;
}
import { LoadingSpinner } from '../LoadingSpinner';
import { BaseDrawer } from '../BaseDrawer';
import { HeaderPill, PillButton } from '../HeaderPill';
import { SearchInput } from '../SearchInput';
import { ContentWrapper } from '../ContentWrapper';
import { ErrorDisplay } from '../ErrorDisplay';
import { TextInput } from '../FormInputs';
import { useGeolocation } from '../../Hooks/useGeolocation';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { useAuth } from '../../Hooks/useAuth';
import { getOverlays } from '../../lib/mapOverlayService';
import { useMapOverlayWrite } from '../../Hooks/useMapOverlayWrite';
import { useMapOverlaySync } from '../../Hooks/useMapOverlaySync';
import { useInvalidation } from '../../stores/useInvalidationStore';
import { loadCachedClinicUsers } from '../../lib/clinicUsersCache';
import {
  downloadTilesForOverlay,
  evictOverlayTiles,
  getAllTileMeta,
  computeOverlayBbox,
  type TileMetadata,
} from '../../lib/mapTileService';
import { getClinicDetails } from '../../lib/supervisorService';
import { listLocations } from '../../lib/adminService';
import type { OverlayFeature, DrawMode, WaypointType } from '../../Types/MapOverlayTypes';
import type { LocalMapOverlay, MapOverlay } from '../../Types/MapOverlayTypes';
import { DEFAULT_FEATURE_STYLE, WAYPOINT_LABELS, PIN_GLYPHS } from '../../Types/MapOverlayTypes';
import { WaypointIcon } from './WaypointIcon';
import MapView from './MapView';
import type { MapViewHandle, PresenceMarker } from './MapView';
import { useLocationPublisher } from '../../Hooks/useLocationPublisher';
import { useCalendarStore } from '../../stores/useCalendarStore';
import { useMapPrefsStore } from '../../stores/useMapPrefsStore';
import { formatBearing } from '../../lib/declination';
import { MGRSConverter } from './MGRSConverter';
import { MapSettingsDrawer, MapSettingsBody } from './MapSettingsDrawer';
import { FeatureEditor } from './FeatureEditor';
import { MapOverlayTree } from './MapOverlayTree';
import { OverlayEventPicker } from './OverlayEventPicker';
import { useCalendarWrite } from '../../Hooks/useCalendarWrite';
import { addFeatureLink, addOverlayLink, removeFeatureLink, removeOverlayLink } from '../../lib/eventLinks';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { resolveSearch } from './searchResolver';
import { MapSearchOverlay, type SearchOverlaySelection } from './MapSearchOverlay';
import { useMapSearchStore } from '../../stores/useMapSearchStore';
import { GotoWaypointCard } from './GotoWaypointCard';
import { parseGPX, serializeGPX } from '../../lib/gpx';
import { parseKML, serializeKML } from '../../lib/kml';
import { useTrackRecorder } from '../../lib/trackRecording';
import { registerAllImportedBasemaps, importMBTiles, deleteImportedBasemap, type MBTilesImportProgress } from '../../lib/mapImporters/mbtiles';
import { importGeoPdf, type GeoPdfImportProgress } from '../../lib/mapImporters/geopdf';
import { TILE_SOURCES } from '../../lib/mapTileService';
import { GeoPdfImportForm } from './GeoPdfImportForm';
import { latLngToUTM } from './utmProjection';
import { latLngToMgrs } from '../../lib/mgrsFormat';

function VertexCoordInput({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = useCallback(async () => {
    const q = value.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await resolveSearch(q);
      if (!r) {
        setError('Could not resolve coordinate or address');
        return;
      }
      onAdd(r.lat, r.lng);
      setValue('');
    } catch {
      setError('Lookup failed');
    } finally {
      setBusy(false);
    }
  }, [value, busy, onAdd]);
  return (
    <div>
      <div className="flex items-center border-b border-primary/6">
        <div className="flex-1 min-w-0">
          <TextInput
            value={value}
            onChange={(v) => { setValue(v); setError(null); }}
            placeholder="MGRS, UTM, lat,lng, or address"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || busy}
          aria-label="Add vertex"
          className="shrink-0 w-9 h-9 mr-3 rounded-full bg-themeblue3 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
        >
          <Plus size={16} />
        </button>
      </div>
      {error && <ErrorDisplay message={error} />}
    </div>
  );
}

function TempRouteBody({ points, closed = false, onRemoveVertex, onAddVertex }: { points: [number, number][]; closed?: boolean; onRemoveVertex?: (index: number) => void; onAddVertex?: (lat: number, lng: number) => void }) {
  if (points.length === 0) return null;
  if (points.length < 2) {
    return (
      <div>
        {onAddVertex && <VertexCoordInput onAdd={onAddVertex} />}
        <div className="p-3">
          <div className="px-2.5 py-2 rounded-lg bg-themeblue3/10 text-[10pt] text-primary">
            Tap map to set next end point.
          </div>
        </div>
      </div>
    );
  }
  let totalM = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [aLat, aLng] = points[i];
    const [bLat, bLng] = points[i + 1];
    totalM += haversine(aLat, aLng, bLat, bLng).distanceM;
  }
  const [sLat, sLng] = points[0];
  const [eLat, eLng] = points[points.length - 1];
  const { bearing } = haversine(sLat, sLng, eLat, eLng);
  const distance = totalM >= 1000 ? `${(totalM / 1000).toFixed(2)} km` : `${Math.round(totalM)} m`;
  const startMgrs = latLngToMgrs(sLat, sLng, 5) || '—';
  const endMgrs = latLngToMgrs(eLat, eLng, 5) || '—';
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Shape', value: closed ? 'Closed (area)' : 'Open (route)' },
    { label: 'Distance', value: distance },
    { label: 'Bearing', value: `${Math.round(bearing)}°` },
    { label: 'Legs', value: String(closed ? points.length : points.length - 1) },
    { label: 'Start', value: startMgrs },
    { label: 'End', value: endMgrs },
  ];
  const canRemove = points.length > 2;
  return (
    <div>
      {onAddVertex && !closed && <VertexCoordInput onAdd={onAddVertex} />}
    <div className="flex flex-col gap-2 p-3">
      {rows.map(row => (
        <div key={row.label} className="px-2.5 py-2 rounded-lg bg-themewhite2/60 dark:bg-themewhite3/60">
          <div className="text-[9pt] font-medium text-tertiary uppercase tracking-wide">{row.label}</div>
          <div className="text-[10pt] font-mono text-primary truncate" title={row.value}>{row.value}</div>
        </div>
      ))}
      <div className="mt-1">
        <div className="text-[9pt] font-medium text-tertiary uppercase tracking-wide px-2.5 mb-1">Vertices</div>
        <div className="rounded-lg overflow-hidden border border-tertiary/10">
          {points.map(([lat, lng], idx) => {
            const isEnd = idx === points.length - 1;
            const role = idx === 0 ? 'Start' : isEnd ? 'End' : `Via ${idx}`;
            const coord = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            const legLabel = idx > 0 ? (() => {
              const [pLat, pLng] = points[idx - 1];
              const { distanceM, bearing } = haversine(pLat, pLng, lat, lng);
              const dist = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${Math.round(distanceM)} m`;
              return `${dist} · ${Math.round(bearing).toString().padStart(3, '0')}°`;
            })() : null;
            return (
              <div key={idx}>
                {legLabel && (
                  <div className="px-2.5 py-1 text-[9pt] font-mono text-tertiary bg-themewhite2/20 dark:bg-themewhite3/20 border-b border-tertiary/10">
                    ↓ {legLabel}
                  </div>
                )}
                <div className="flex items-center gap-2 px-2.5 py-1.5 border-b last:border-b-0 border-tertiary/10 bg-themewhite2/40 dark:bg-themewhite3/40">
                  <div className="text-[9pt] font-medium text-tertiary w-12 shrink-0">{role}</div>
                  <div className="text-[10pt] font-mono text-primary flex-1 min-w-0 truncate" title={coord}>{coord}</div>
                  {onRemoveVertex && canRemove && (
                    <button
                      type="button"
                      onClick={() => onRemoveVertex(idx)}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                      aria-label={`Remove ${role}`}
                      title={`Remove ${role}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}

function TempPointBody({ lat, lng }: { lat: number; lng: number }) {
  const mgrs = latLngToMgrs(lat, lng, 5) || '—';
  let utm = '—';
  try {
    const u = latLngToUTM(lat, lng);
    const e = Math.round(u.easting).toString().padStart(7, '0');
    const n = Math.round(u.northing).toString().padStart(7, '0');
    utm = `${u.zone}${u.northern ? 'N' : 'S'} ${e} ${n}`;
  } catch { /* ignore */ }
  const latLng = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const rows: Array<{ label: string; value: string }> = [
    { label: 'MGRS', value: mgrs },
    { label: 'UTM', value: utm },
    { label: 'Lat / Lng', value: latLng },
  ];
  return (
    <div className="flex flex-col gap-2 p-3">
      {rows.map(row => (
        <div key={row.label} className="px-2.5 py-2 rounded-lg bg-themewhite2/60 dark:bg-themewhite3/60">
          <div className="text-[9pt] font-medium text-tertiary uppercase tracking-wide">{row.label}</div>
          <div className="text-[10pt] font-mono text-primary truncate" title={row.value}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

type ViewState = 'viewer' | 'converter';

interface MapOverlayPanelProps {
  isVisible: boolean;
  onClose: () => void;
  initialOverlayId?: string | null;
  initialFeatureId?: string | null;
}

const UI_TIMING = { FEEDBACK_DURATION: 4000 } as const;
// Pixel-distance threshold for snapping route/area vertices to nearby waypoints.
const SNAP_PX = 22;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): { distanceM: number; bearing: number } {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceM = R * c;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return { distanceM, bearing };
}

/**
 * Given a polyline and a click point, return the array index at which a new
 * vertex should be inserted so it lands on the closest existing segment.
 * Uses planar distance in lat/lng — the small error at typical AO scales is
 * irrelevant for picking which segment the user tapped.
 */
function closestSegmentInsertIndex(geometry: [number, number][], point: [number, number]): number {
  if (geometry.length < 2) return geometry.length;
  let bestIdx = 1;
  let bestDist = Infinity;
  const [px, py] = point;
  for (let i = 0; i < geometry.length - 1; i++) {
    const [ax, ay] = geometry[i];
    const [bx, by] = geometry[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const distSq = (px - cx) ** 2 + (py - cy) ** 2;
    if (distSq < bestDist) {
      bestDist = distSq;
      bestIdx = i + 1;
    }
  }
  return bestIdx;
}

export function MapOverlayPanel({ isVisible, onClose, initialOverlayId, initialFeatureId }: MapOverlayPanelProps) {
  const isMobile = useIsMobile();
  const { user, clinicId, supervisingClinicId } = useAuth();
  // Active operating-as clinic — single source of truth for overlay scoping,
  // clinic-location resolution, and vault fan-out target. Mirrors the calendar /
  // messaging / clinic-settings convention so a supervisor toggled into a loan
  // clinic sees and writes that clinic's overlays.
  const activeClinicId = supervisingClinicId ?? clinicId;
  const bearingReference = useMapPrefsStore(s => s.bearingReference);
  const basemapId = useMapPrefsStore(s => s.basemapId);

  // Map overlays propagate via the clinic Signal vault. writeOverlay/deleteOverlay
  // own the optimistic IDB write + vault fan-out; useMapOverlaySync hydrates the
  // tombstone set; useInvalidation('mapOverlays') re-fires the load effect when
  // vault drain delivers a remote create/update/delete.
  useMapOverlaySync();
  const {
    writeOverlay,
    upsertFeature,
    removeFeature,
    writeOverlayMetadata,
    deleteOverlay: vaultDeleteOverlay,
  } = useMapOverlayWrite();
  const overlayGen = useInvalidation('mapOverlays');

  const [view, setView] = useState<ViewState>('viewer');
  const [showPopover, setShowPopover] = useState(false);
  const [showMobileTree, setShowMobileTree] = useState(false);
  const [addSheet, setAddSheet] = useState<'root' | 'feature' | 'import' | null>(null);
  const [pinPickerPage, setPinPickerPage] = useState<number | null>(null);
  const [visibleOverlayIds, setVisibleOverlayIds] = useState<Set<string>>(new Set());
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState('');
  const [features, setFeatures] = useState<OverlayFeature[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>('pan');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  // Read vs. edit mode for the selected-feature panel. Title-in-header is the
  // read affordance; flipping to edit hides the header title, surfaces the
  // TextInput for the label, and swaps the TC3 + linked-events rows into
  // PickerInput-style selectors. Resets on selection change so each feature
  // starts in read mode.
  const [isFeatureEditMode, setIsFeatureEditMode] = useState(false);
  useEffect(() => {
    setIsFeatureEditMode(false);
  }, [selectedFeatureId]);
  // Transient single-tap / long-press marker. Does NOT commit a feature —
  // user must explicitly promote it via "Save as waypoint" in the temp-point
  // drawer. Prevents accidental waypoint litter from stray taps.
  const [tempPoint, setTempPoint] = useState<{ lat: number; lng: number } | null>(null);
  // Pin-to-pin navigation route. Each map tap extends the end. `history`
  // stores prior `points` snapshots so the Undo pill can pop the last change.
  const [tempRoute, setTempRoute] = useState<{
    points: [number, number][];
    anchorFeatureId: string | null;
    history: [number, number][][];
    // True once the user taps near points[0] (>=3 pts). Renders a closing
    // segment in MapView and swaps the primary save action to "Save area".
    closed: boolean;
  } | null>(null);
  const [gotoDismissedFor, setGotoDismissedFor] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const pushRecent = useMapSearchStore(s => s.pushRecent);

  // Measure tool
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureResult, setMeasureResult] = useState<{ distanceM: number; bearing: number } | null>(null);

  // Selected glyph for the pin tool — persists across drops in a session
  const [pinType, setPinType] = useState<WaypointType>('circle');

  // Clinic location auto-focus
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  // Overlay list + loading
  const [overlays, setOverlays] = useState<LocalMapOverlay[]>([]);
  const [loading, setLoading] = useState(false);

  // Save flow
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [mapZoom, setMapZoom] = useState(4);

  // Route/area drawing accumulation
  const inProgressGeometry = useRef<[number, number][]>([]);
  const inProgressFeatureId = useRef<string | null>(null);

  const resetInProgressDrawing = useCallback(() => {
    inProgressGeometry.current = [];
    inProgressFeatureId.current = null;
  }, []);

  // Draft mode: feature mutations stay local until the user taps Save in the
  // FeatureEditor. skipDirtyRef suppresses the dirty-flip immediately after
  // handleOpenOverlay/handleNewOverlay populates features so the load itself
  // doesn't register as a user edit.
  const skipDirtyRef = useRef(true);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscardClose, setConfirmDiscardClose] = useState(false);

  // Diff-based autosave: lastSaved*Ref hold the snapshot the vault was last
  // told about, so each autosave dispatches only the per-feature envelopes
  // whose features changed (instead of re-encrypting the whole overlay's
  // features[] for every recipient). Mirrors calendar's "one envelope per
  // logical unit" pattern at the feature granularity.
  // overlayCreatedRef tracks overlays the vault has already seen — on first
  // save we fall back to bulk writeOverlay (one envelope carrying all initial
  // features); subsequent edits go per-feature.
  const lastSavedFeaturesRef = useRef<OverlayFeature[]>([]);
  const lastSavedMetadataRef = useRef<{ name: string; center: [number, number]; zoom: number } | null>(null);
  const overlayCreatedRef = useRef<Set<string>>(new Set());
  const [confirmDeleteOverlayId, setConfirmDeleteOverlayId] = useState<string | null>(null);
  const [confirmDeleteFeature, setConfirmDeleteFeature] = useState<string | null>(null);

  const mapRef = useRef<MapViewHandle>(null);
  const gpxKmlInputRef = useRef<HTMLInputElement>(null);
  const mbtilesInputRef = useRef<HTMLInputElement>(null);
  const hasAutoNavigated = useRef(false);
  const [searchPending, setSearchPending] = useState(false);

  // Tile cache state
  const [tileMetaMap, setTileMetaMap] = useState<Map<string, TileMetadata>>(new Map());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  const { position, startWatching, stopWatching } = useGeolocation();

  const gpsPosition = position
    ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy }
    : null;

  // ── Location sharing ──
  const [isSharing, setIsSharing] = useState(false);
  const [hasManuallySetSharing, setHasManuallySetSharing] = useState(false);
  const allEvents = useCalendarStore(s => s.events);
  // Find the calendar event that owns this overlay (structured_location.overlay_id)
  const linkedEvent = overlayId
    ? (allEvents.find(e =>
        e.structured_location?.overlay_id === overlayId &&
        (!activeClinicId || e.clinic_id === activeClinicId)
      ) ?? null)
    : null;

  // Inverse-link surface — overlay-id → linked CalendarEvent(s). Drives the
  // calendar chip on each overlay row and the link/unlink actions.
  const linkedOverlayIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of allEvents) {
      if (activeClinicId && e.clinic_id !== activeClinicId) continue;
      const id = e.structured_location?.overlay_id;
      if (id) ids.add(id);
    }
    return ids;
  }, [allEvents, activeClinicId]);

  const { writeEvent } = useCalendarWrite();
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent);

  const [linkPicker, setLinkPicker] = useState<{ overlayId: string; anchor: DOMRect } | null>(null);
  const [linksEditor, setLinksEditor] = useState<{ overlayId: string; anchor: DOMRect } | null>(null);
  const [featureLinksEditor, setFeatureLinksEditor] = useState<{ overlayId: string; featureId: string; anchor: DOMRect } | null>(null);

  const handleJumpToLinkedEvent = useCallback((targetOverlayId: string) => {
    const next = allEvents
      .filter(e => e.structured_location?.overlay_id === targetOverlayId)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    if (!next) return;
    openCalendarEvent(next.id);
  }, [allEvents, openCalendarEvent]);

  const handleOpenLinkPicker = useCallback((targetOverlayId: string, anchor: HTMLElement) => {
    setLinkPicker({ overlayId: targetOverlayId, anchor: anchor.getBoundingClientRect() });
  }, []);

  const handlePickEventForLink = useCallback((event: CalendarEvent) => {
    if (!linkPicker) return;
    // Clear the link from any other event that currently points at this
    // overlay so the inverse-link surface stays 1:1 from the user's POV.
    const stale = allEvents.filter(e =>
      e.structured_location?.overlay_id === linkPicker.overlayId && e.id !== event.id,
    );
    for (const s of stale) {
      writeEvent({ ...s, structured_location: null, updated_at: new Date().toISOString() });
    }
    writeEvent({
      ...event,
      structured_location: { overlay_id: linkPicker.overlayId },
      updated_at: new Date().toISOString(),
    });
  }, [linkPicker, allEvents, writeEvent]);

  const handleUnlinkEvent = useCallback((targetOverlayId: string) => {
    const bound = allEvents.filter(e => e.structured_location?.overlay_id === targetOverlayId);
    for (const e of bound) {
      writeEvent({ ...e, structured_location: null, updated_at: new Date().toISOString() });
    }
  }, [allEvents, writeEvent]);

  const handleOpenLinksEditor = useCallback((targetOverlayId: string, anchor: HTMLElement) => {
    setLinksEditor({ overlayId: targetOverlayId, anchor: anchor.getBoundingClientRect() });
  }, []);

  const handleToggleOverlayLink = useCallback((event: CalendarEvent, willLink: boolean) => {
    if (!linksEditor) return;
    const next = willLink
      ? addOverlayLink(event, linksEditor.overlayId)
      : removeOverlayLink(event, linksEditor.overlayId);
    if (next === event) return;
    writeEvent({ ...next, updated_at: new Date().toISOString() });
  }, [linksEditor, writeEvent]);

  const handleOpenFeatureLinksEditor = useCallback((targetOverlayId: string, targetFeatureId: string, anchor: HTMLElement) => {
    setFeatureLinksEditor({ overlayId: targetOverlayId, featureId: targetFeatureId, anchor: anchor.getBoundingClientRect() });
  }, []);

  const handleToggleFeatureLink = useCallback((event: CalendarEvent, willLink: boolean) => {
    if (!featureLinksEditor) return;
    const { overlayId: ov, featureId: fid } = featureLinksEditor;
    const next = willLink
      ? addFeatureLink(event, ov, fid)
      : removeFeatureLink(event, ov, fid);
    if (next === event) return;
    writeEvent({ ...next, updated_at: new Date().toISOString() });
  }, [featureLinksEditor, writeEvent]);

  const linkedEventIdsForOverlay = useMemo(() => {
    const id = linksEditor?.overlayId;
    if (!id) return new Set<string>();
    const set = new Set<string>();
    for (const e of allEvents) {
      if (e.linked_overlays?.includes(id)) set.add(e.id);
    }
    return set;
  }, [linksEditor?.overlayId, allEvents]);

  const linkedEventIdsForFeature = useMemo(() => {
    const ed = featureLinksEditor;
    if (!ed) return new Set<string>();
    const set = new Set<string>();
    for (const e of allEvents) {
      const explicit = e.linked_features?.some(f => f.overlay_id === ed.overlayId && f.feature_id === ed.featureId);
      const implied = e.linked_overlays?.includes(ed.overlayId);
      if (explicit || implied) set.add(e.id);
    }
    return set;
  }, [featureLinksEditor, allEvents]);

  // Phase 4.3a — auto-share when the linked event is in_progress AND the
  // current user is a participant. Manual toggles win — once the user
  // touches the share button we never auto-flip again for this session.
  useEffect(() => {
    if (hasManuallySetSharing) return;
    if (!linkedEvent || !user) return;
    const userIsParticipant = linkedEvent.assigned_to.includes(user.id);
    const eventActive = linkedEvent.status === 'in_progress';
    setIsSharing(userIsParticipant && eventActive);
  }, [linkedEvent?.id, linkedEvent?.status, linkedEvent?.assigned_to, user?.id, hasManuallySetSharing]);

  const handleToggleSharing = useCallback(() => {
    setHasManuallySetSharing(true);
    setIsSharing(prev => !prev);
  }, []);

  // ── User identity for presence markers ──
  const [userLabels, setUserLabels] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    loadCachedClinicUsers().then(users => {
      setUserLabels(new Map(users.map(u => [
        u.id,
        [u.rank, u.lastName].filter(Boolean).join(' ') || u.firstName || u.id.slice(0, 8),
      ])));
    });
  }, []);

  // Derive presence markers from the event's field_positions for all participants
  const presenceMarkers: PresenceMarker[] = linkedEvent?.field_positions
    ? Object.entries(linkedEvent.field_positions).map(([userId, pos]) => ({
        userId,
        lat: pos.lat,
        lng: pos.lng,
        timestamp: pos.timestamp,
        label: userLabels.get(userId) || pos.mgrs || userId.slice(0, 8),
      }))
    : [];

  useLocationPublisher(linkedEvent?.id ?? null, user?.id ?? null, position, isSharing);

  // Register every persisted imported basemap (Phase 3) when the panel opens
  // so the user's MBTiles / geo-PDF imports show up in the basemap selector.
  // Idempotent — registerTileSource overwrites by id.
  const [importedReloadKey, setImportedReloadKey] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    registerAllImportedBasemaps();
  }, [isVisible, importedReloadKey]);

  const [mbtilesProgress, setMbtilesProgress] = useState<{ name: string; done: number; total: number; phase: string } | null>(null);
  const setBasemapId = useMapPrefsStore(s => s.setBasemapId);

  const handleImportMBTiles = useCallback(async (file: File) => {
    setMbtilesProgress({ name: file.name, done: 0, total: 0, phase: 'parsing' });
    const ctrl = importMBTiles(file, (p: MBTilesImportProgress) => {
      setMbtilesProgress(prev => prev ? { ...prev, done: p.done, total: p.total, phase: p.phase } : prev);
    });
    const meta = await ctrl.promise;
    setMbtilesProgress(null);
    if (meta) {
      setImportedReloadKey(k => k + 1);
      setBasemapId(meta.sourceId);
    }
  }, [setBasemapId]);

  const handleDeleteImportedBasemap = useCallback(async (sourceId: string) => {
    if (basemapId === sourceId) setBasemapId('osm');
    await deleteImportedBasemap(sourceId);
    delete TILE_SOURCES[sourceId];
    setImportedReloadKey(k => k + 1);
  }, [basemapId, setBasemapId]);

  const [geoPdfFormOpen, setGeoPdfFormOpen] = useState(false);
  const [geoPdfProgress, setGeoPdfProgress] = useState<{ name: string; done: number; total: number; phase: string } | null>(null);

  const handleOpenGeoPdfForm = useCallback(() => setGeoPdfFormOpen(true), []);

  const handleGeoPdfSubmit = useCallback(async (file: File, bounds: [number, number, number, number]) => {
    setGeoPdfProgress({ name: file.name, done: 0, total: 0, phase: 'parsing' });
    const ctrl = importGeoPdf(file, { bounds }, (p: GeoPdfImportProgress) => {
      setGeoPdfProgress(prev => prev ? { ...prev, done: p.done, total: p.total, phase: p.phase } : prev);
    });
    const meta = await ctrl.promise;
    setGeoPdfProgress(null);
    if (meta) {
      setImportedReloadKey(k => k + 1);
      setBasemapId(meta.sourceId);
      // Fly the map to the imported area so the user immediately sees it.
      if (meta.bounds) setTimeout(() => mapRef.current?.fitBounds(meta.bounds!), 320);
    }
  }, [setBasemapId]);

  const selectedFeature = features.find(f => f.id === selectedFeatureId) ?? null;

  const recorder = useTrackRecorder({
    overlayId,
    gps: gpsPosition ? { lat: gpsPosition.lat, lng: gpsPosition.lng, accuracy: gpsPosition.accuracy } : null,
  });

  const handleStartRecording = useCallback(async () => {
    if (recorder.status === 'idle') await recorder.start();
    else if (recorder.status === 'paused') await recorder.resume();
  }, [recorder]);

  const handlePauseRecording = useCallback(async () => {
    await recorder.pause();
  }, [recorder]);

  const handleStopRecording = useCallback(async () => {
    if (!overlayId) return;
    const result = await recorder.stop();
    if (!result || result.geometry.length < 2) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const recordedFeature: OverlayFeature = {
      id,
      overlay_id: overlayId,
      type: 'route',
      geometry: result.geometry,
      label: `Track · ${new Date(result.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      style: { ...DEFAULT_FEATURE_STYLE },
      recorded: true,
      recorded_started_at: result.startedAt,
      recorded_ended_at: result.endedAt,
      created_at: now,
      updated_at: now,
    };
    setFeatures(prev => [...prev, recordedFeature]);
    setDrawMode('pan');
  }, [overlayId, recorder]);

  // ── Load overlays + auto-navigate to viewer on first open ──
  useEffect(() => {
    if (!isVisible) {
      hasAutoNavigated.current = false;
      setShowPopover(false);
      return;
    }
    if (!activeClinicId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getOverlays(activeClinicId), getAllTileMeta()]).then(([result, meta]) => {
      if (cancelled) return;
      const loaded: LocalMapOverlay[] = result.ok ? result.data : [];
      if (result.ok) setOverlays(loaded);
      setTileMetaMap(meta);
      setLoading(false);
      if (!hasAutoNavigated.current) {
        hasAutoNavigated.current = true;
        if (initialOverlayId) {
          const target = loaded.find(o => o.id === initialOverlayId);
          if (target) {
            handleOpenOverlay(target as MapOverlay);
            if (initialFeatureId && target.features.some(f => f.id === initialFeatureId)) {
              setSelectedFeatureId(initialFeatureId);
            }
          } else {
            handleNewOverlay({ recenter: true });
          }
        } else if (loaded.length > 0) {
          const latest = loaded.reduce((best, o) =>
            new Date(o.updated_at) > new Date(best.updated_at) ? o : best
          );
          handleOpenOverlay(latest as MapOverlay);
        } else {
          handleNewOverlay({ recenter: true });
        }
      }
    });
    return () => { cancelled = true; };
    // overlayGen bumps when the vault delivers an inbound create/update/delete,
    // refetching IDB so the panel reflects remote changes without a manual reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, activeClinicId, overlayGen]);

  // ── Auto-clear save error ──
  useEffect(() => {
    if (!saveError) return;
    const t = setTimeout(() => setSaveError(null), UI_TIMING.FEEDBACK_DURATION);
    return () => clearTimeout(t);
  }, [saveError]);

  // ── Resolve clinic location to coordinates for map default center ──
  // Prefer the structured locations.lat/lon (clinic.location_id → locations
  // row) over geocoding the legacy free-text clinic.location string. The
  // ISO/installation record is admin-curated and exact; the free-text field
  // is decrypted-per-clinic and lossy when geocoded.
  useEffect(() => {
    if (!activeClinicId || initialCenter) return;
    let cancelled = false;
    (async () => {
      const details = await getClinicDetails(activeClinicId);
      if (cancelled) return;

      if (details.location_id) {
        const locs = await listLocations();
        if (cancelled) return;
        const loc = locs.find(l => l.id === details.location_id);
        if (loc?.lat != null && loc?.lon != null) {
          setInitialCenter([loc.lat, loc.lon]);
          return;
        }
        if (loc?.display_name) {
          const result = await resolveSearch(loc.display_name);
          if (cancelled || !result) return;
          setInitialCenter([result.lat, result.lng]);
          return;
        }
      }

      if (details.location) {
        const result = await resolveSearch(details.location);
        if (cancelled || !result) return;
        setInitialCenter([result.lat, result.lng]);
      }
    })();
    return () => { cancelled = true; };
  }, [activeClinicId, initialCenter]);

  // ── Spinner fade spring ──
  const spinnerSpring = useSpring({
    opacity: searchPending ? 1 : 0,
    config: { tension: 200, friction: 22 },
  });

  // Import GPX / KML from a File. Creates a new overlay seeded with the
  // parsed features and named after the file (or its embedded metadata).
  // Autosave persists it once features land.
  const handleImportFile = useCallback(async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const ext = lowerName.endsWith('.gpx') ? 'gpx' : lowerName.endsWith('.kml') ? 'kml' : null;
    if (!ext) {
      setSaveError('Unsupported file — use .gpx or .kml');
      return;
    }
    let text: string;
    try { text = await file.text(); }
    catch { setSaveError('Could not read file'); return; }

    const newId = crypto.randomUUID();
    try {
      const parsed = ext === 'gpx' ? parseGPX(text, newId) : parseKML(text, newId);
      const importName = parsed.suggestedName ?? file.name.replace(/\.[^/.]+$/, '');
      // Re-stamp parent overlay_id on imported features.
      const stamped = parsed.features.map(f => ({ ...f, overlay_id: newId }));
      setOverlayId(newId);
      setOverlayName(importName);
      setFeatures(stamped);
      setDrawMode('pan');
      setSelectedFeatureId(null);
      setSearchQuery('');
      // Import is a brand-new overlay — autosave will use the bulk-create
      // path which ships imported features in a single overlay envelope.
      lastSavedFeaturesRef.current = [];
      lastSavedMetadataRef.current = null;
      resetInProgressDrawing();
      setView('viewer');
      setShowPopover(false);
      setVisibleOverlayIds(prev => new Set([...prev, newId]));
      startWatching();
      // Allow autosave to persist on next features change (don't suppress).
      skipDirtyRef.current = false;
      // Fit to imported features.
      const bbox = computeOverlayBbox(stamped);
      if (bbox) setTimeout(() => mapRef.current?.fitBounds(bbox), 400);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Parse failed');
    }
  }, [startWatching]);

  // Export the active overlay's features as a downloadable file.
  const handleExportOverlay = useCallback((overlay: MapOverlay, format: 'gpx' | 'kml') => {
    const text = format === 'gpx'
      ? serializeGPX(overlay.features, overlay.name || 'Overlay')
      : serializeKML(overlay.features, overlay.name || 'Overlay');
    const blob = new Blob([text], { type: format === 'gpx' ? 'application/gpx+xml' : 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(overlay.name || 'overlay').replace(/[^\w\-]+/g, '_')}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const handleNewOverlay = useCallback((opts?: { recenter?: boolean }) => {
    const id = crypto.randomUUID();
    setOverlayId(id);
    setOverlayName('');
    setFeatures([]);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setSearchQuery('');
    setTempRoute(null);
    // Reset diff-baselines so the first autosave runs the bulk-create path
    // (writeOverlay) which lands the overlay record + initial features on the
    // vault in one envelope.
    lastSavedFeaturesRef.current = [];
    lastSavedMetadataRef.current = null;
    resetInProgressDrawing();
    setView('viewer');
    setShowPopover(false);
    setVisibleOverlayIds(prev => new Set([...prev, id]));
    startWatching();
    // Only recenter on cold-open (no overlays yet); explicit "New overlay" from
    // FAB/tree keeps the user's current view so they can draw on what they see.
    if (opts?.recenter && initialCenter) {
      setTimeout(() => mapRef.current?.flyTo(initialCenter[0], initialCenter[1], 12), 400);
    }
    // New-overlay flow: autosave names it on first feature mutation.
    skipDirtyRef.current = true;
  }, [startWatching, initialCenter]);

  const handleOpenOverlay = useCallback((overlay: MapOverlay) => {
    setOverlayId(overlay.id);
    setOverlayName(overlay.name);
    setFeatures(overlay.features);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setSearchQuery('');
    setTempRoute(null);
    skipDirtyRef.current = true;
    // Seed diff-baselines: the overlay already exists in IDB and on the vault,
    // so subsequent edits go straight to per-feature envelopes.
    overlayCreatedRef.current.add(overlay.id);
    lastSavedFeaturesRef.current = overlay.features;
    lastSavedMetadataRef.current = { name: overlay.name, center: overlay.center, zoom: overlay.zoom };
    resetInProgressDrawing();
    setView('viewer');
    setShowPopover(false);
    setVisibleOverlayIds(prev => new Set([...prev, overlay.id]));
    startWatching();
    if (overlay.features.length > 0) {
      const bbox = computeOverlayBbox(overlay.features);
      if (bbox) setTimeout(() => mapRef.current?.fitBounds(bbox), 400);
    } else if (initialCenter) {
      setTimeout(() => mapRef.current?.flyTo(initialCenter[0], initialCenter[1], 12), 400);
    }
  }, [startWatching, initialCenter]);

  const handleToggleVisible = useCallback((overlayId: string) => {
    setVisibleOverlayIds(prev => {
      const next = new Set(prev);
      if (next.has(overlayId)) next.delete(overlayId);
      else next.add(overlayId);
      return next;
    });
  }, []);

  const handleDeleteOverlay = useCallback((id: string) => {
    setConfirmDeleteOverlayId(id);
  }, []);

  const handleConfirmDeleteOverlay = useCallback(async () => {
    const id = confirmDeleteOverlayId;
    if (!id || !user) return;
    setConfirmDeleteOverlayId(null);
    await vaultDeleteOverlay(id);
    setOverlays(prev => prev.filter(o => o.id !== id));
    // Evict cached tiles for deleted overlay (fire-and-forget)
    evictOverlayTiles(id).then(() => {
      setTileMetaMap(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });
  }, [confirmDeleteOverlayId, user, vaultDeleteOverlay]);

  const handleDownloadTiles = useCallback(async (overlay: MapOverlay) => {
    if (downloadingId) return;
    setDownloadingId(overlay.id);
    setDownloadProgress({ done: 0, total: 0 });
    try {
      const meta = await downloadTilesForOverlay(
        overlay.id,
        overlay.features,
        (done, total) => setDownloadProgress({ done, total }),
        basemapId,
      );
      if (meta) {
        setTileMetaMap(prev => new Map(prev).set(overlay.id, meta));
      }
    } finally {
      setDownloadingId(null);
      setDownloadProgress(null);
    }
  }, [downloadingId, basemapId]);

  const handleEvictTiles = useCallback(async (id: string) => {
    await evictOverlayTiles(id);
    setTileMetaMap(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleOpenConverter = useCallback(() => {
    setView('converter');
  }, []);

  const performClose = useCallback(() => {
    stopWatching();
    setIsSharing(false);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setMeasurePoints([]);
    setMeasureResult(null);
    resetInProgressDrawing();
    onClose();
  }, [stopWatching, onClose, resetInProgressDrawing]);

  const handleBack = useCallback(() => {
    if (view !== 'viewer') {
      setView('viewer');
      return;
    }
    if (isDirty) {
      setConfirmDiscardClose(true);
      return;
    }
    performClose();
  }, [view, isDirty, performClose]);

  // Create a real waypoint feature at the given point. Shared by pin-mode
  // taps, desktop single-click drops, and mobile long-press drops.
  const dropPinAt = useCallback((lat: number, lng: number) => {
    if (!overlayId) return;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    setFeatures(prev => {
      const wptIndex = prev.filter(f => f.type === 'waypoint').length + 1;
      const feature: OverlayFeature = {
        id,
        overlay_id: overlayId,
        type: 'waypoint',
        geometry: [[lat, lng]],
        label: `Point ${wptIndex}`,
        waypoint_type: pinType,
        style: { ...DEFAULT_FEATURE_STYLE },
        created_at: now,
        updated_at: now,
      };
      return [...prev, feature];
    });
    setSelectedFeatureId(id);
    // After placement the feature drawer/panel takes over editing, so the
    // on-map glyph picker is redundant — dismiss it.
    setPinPickerPage(null);
  }, [overlayId, pinType]);

  // Push the current points into history and replace with `next`. Declared
  // before handleMapClick so its dependency array can reference this without
  // hitting TDZ on first render.
  const commitTempRouteChange = useCallback((next: [number, number][]) => {
    setTempRoute(prev => prev ? ({
      ...prev,
      points: next,
      history: [...prev.history, prev.points].slice(-50),
    }) : null);
  }, []);

  // ── Map click handler ──
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!overlayId) return;
    const now = new Date().toISOString();

    // Pin-to-pin navigation: every map tap appends the new point to the end,
    // demoting the previous end to a via-point. Bypasses regular pan/temp-
    // point handling. All mutations route through commitTempRouteChange so
    // Undo can pop them.
    if (tempRoute) {
      // Tap near the first vertex (>=3 pts) closes the loop AND auto-commits
      // it as an area feature. The closing gesture is the save — no extra
      // click needed. "Save as area" pill remains for users who don't hit
      // the snap radius.
      if (tempRoute.points.length >= 3) {
        const [sLat, sLng] = tempRoute.points[0];
        const px = mapRef.current?.containerDistancePx(lat, lng, sLat, sLng) ?? Infinity;
        if (px < SNAP_PX) {
          const id = crypto.randomUUID();
          const closingPoints = [...tempRoute.points];
          setFeatures(prev => {
            const areaIndex = prev.filter(f => f.type === 'area').length + 1;
            const feature: OverlayFeature = {
              id,
              overlay_id: overlayId,
              type: 'area',
              geometry: closingPoints,
              label: `Area ${areaIndex}`,
              style: { ...DEFAULT_FEATURE_STYLE },
              created_at: now,
              updated_at: now,
            };
            return [...prev, feature];
          });
          setTempRoute(null);
          setSelectedFeatureId(id);
          return;
        }
      }
      commitTempRouteChange([...tempRoute.points, [lat, lng]]);
      return;
    }

    if (drawMode === 'measure') {
      if (measurePoints.length < 2) {
        const next = [...measurePoints, [lat, lng] as [number, number]];
        setMeasurePoints(next);
        if (next.length === 2) {
          setMeasureResult(haversine(next[0][0], next[0][1], next[1][0], next[1][1]));
        }
      } else {
        // Third tap resets
        setMeasurePoints([[lat, lng]]);
        setMeasureResult(null);
      }
      return;
    }

    if (drawMode === 'pin') {
      dropPinAt(lat, lng);
      setDrawMode('pan');
      setTempPoint(null);
      return;
    }

    // Snap route/area vertices to nearby waypoints. Pixel-distance threshold
    // so the snap radius feels consistent across zoom levels. Skips the
    // in-progress feature itself in case its starting vertex is the snap.
    if (drawMode === 'route' || drawMode === 'area') {
      let bestPx = SNAP_PX;
      let snapped: [number, number] | null = null;
      for (const w of features) {
        if (w.type !== 'waypoint' || w.geometry.length === 0) continue;
        const [wLat, wLng] = w.geometry[0];
        const px = mapRef.current?.containerDistancePx(lat, lng, wLat, wLng) ?? Infinity;
        if (px < bestPx) {
          bestPx = px;
          snapped = [wLat, wLng];
        }
      }
      if (snapped) {
        lat = snapped[0];
        lng = snapped[1];
      }
    }

    if (drawMode === 'route') {
      inProgressGeometry.current = [...inProgressGeometry.current, [lat, lng]];

      if (inProgressGeometry.current.length === 1) {
        const id = crypto.randomUUID();
        inProgressFeatureId.current = id;
        const routeIndex = features.filter(f => f.type === 'route').length + 1;
        const feature: OverlayFeature = {
          id,
          overlay_id: overlayId,
          type: 'route',
          geometry: [...inProgressGeometry.current],
          label: `Route ${routeIndex}`,
          style: { ...DEFAULT_FEATURE_STYLE },
          created_at: now,
          updated_at: now,
        };
        setFeatures(prev => [...prev, feature]);
        setSelectedFeatureId(id);
      } else {
        const ipId = inProgressFeatureId.current;
        if (ipId) {
          setFeatures(prev => prev.map(f =>
            f.id === ipId ? { ...f, geometry: [...inProgressGeometry.current], updated_at: now } : f
          ));
        }
      }
      return;
    }

    if (drawMode === 'area') {
      inProgressGeometry.current = [...inProgressGeometry.current, [lat, lng]];

      if (inProgressGeometry.current.length === 1) {
        const id = crypto.randomUUID();
        inProgressFeatureId.current = id;
        const areaIndex = features.filter(f => f.type === 'area').length + 1;
        const feature: OverlayFeature = {
          id,
          overlay_id: overlayId,
          type: 'area',
          geometry: [...inProgressGeometry.current],
          label: `Area ${areaIndex}`,
          style: { ...DEFAULT_FEATURE_STYLE },
          created_at: now,
          updated_at: now,
        };
        setFeatures(prev => [...prev, feature]);
        setSelectedFeatureId(id);
      } else {
        const ipId = inProgressFeatureId.current;
        if (ipId) {
          setFeatures(prev => prev.map(f =>
            f.id === ipId ? { ...f, geometry: [...inProgressGeometry.current], updated_at: now } : f
          ));
        }
      }
      return;
    }

    if (drawMode === 'pan') {
      // Desktop single-click drops a transient temp point (mobile waits for
      // long-press). Temp point shows a "Temp point" drawer with coordinates
      // and a Save-as-waypoint promote action — nothing is committed to the
      // feature list until the user explicitly accepts.
      if (!isMobile) {
        setSelectedFeatureId(null);
        setTempPoint({ lat, lng });
      }
    }
  }, [drawMode, overlayId, measurePoints, features, pinType, isMobile, dropPinAt, tempRoute, commitTempRouteChange]);

  // Long-press / right-click → drop a transient temp point regardless of
  // pan mode. Does not commit a waypoint; user promotes via the drawer.
  const handleMapLongPress = useCallback((lat: number, lng: number) => {
    if (!overlayId) return;
    if (drawMode === 'route' || drawMode === 'area' || drawMode === 'measure' || drawMode === 'track') return;
    setSelectedFeatureId(null);
    setTempPoint({ lat, lng });
  }, [overlayId, drawMode]);

  const handlePromoteTempPoint = useCallback(() => {
    if (!tempPoint) return;
    dropPinAt(tempPoint.lat, tempPoint.lng);
    setTempPoint(null);
  }, [tempPoint, dropPinAt]);

  const handleCloseTempPoint = useCallback(() => setTempPoint(null), []);

  // Seed a temp route from a waypoint (or temp point). Next map tap commits
  // the end point. Clears tempPoint + selection so the temp-route drawer
  // gets exclusive focus.
  const handleStartNavigation = useCallback((lat: number, lng: number, anchorFeatureId: string | null) => {
    if (!overlayId) return;
    setTempRoute({ points: [[lat, lng]], anchorFeatureId, history: [], closed: false });
    setTempPoint(null);
    setSelectedFeatureId(null);
    setDrawMode('pan');
    setPinPickerPage(null);
  }, [overlayId]);

  const handleCloseTempRoute = useCallback(() => setTempRoute(null), []);

  const handleTempRouteChange = useCallback((points: [number, number][]) => {
    commitTempRouteChange(points);
  }, [commitTempRouteChange]);

  const handleAddTempRouteVertex = useCallback((lat: number, lng: number) => {
    setTempRoute(prev => {
      if (!prev) return prev;
      return { ...prev, points: [...prev.points, [lat, lng] as [number, number]], history: [...prev.history, prev.points].slice(-50) };
    });
    mapRef.current?.flyTo(lat, lng);
  }, []);

  const handleRemoveTempRouteVertex = useCallback((index: number) => {
    setTempRoute(prev => {
      if (!prev || prev.points.length <= 2) return prev;
      const next = prev.points.filter((_, i) => i !== index);
      return { ...prev, points: next, history: [...prev.history, prev.points].slice(-50) };
    });
  }, []);

  const handleUndoTempRoute = useCallback(() => {
    setTempRoute(prev => {
      if (!prev || prev.history.length === 0) return prev;
      const last = prev.history[prev.history.length - 1];
      return { ...prev, points: last, history: prev.history.slice(0, -1) };
    });
  }, []);

  const handleSaveTempRouteAsFeature = useCallback(() => {
    if (!overlayId || !tempRoute || tempRoute.points.length < 2) return;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    setFeatures(prev => {
      const routeIndex = prev.filter(f => f.type === 'route').length + 1;
      const feature: OverlayFeature = {
        id,
        overlay_id: overlayId,
        type: 'route',
        geometry: [...tempRoute.points],
        label: `Route ${routeIndex}`,
        style: { ...DEFAULT_FEATURE_STYLE },
        created_at: now,
        updated_at: now,
      };
      return [...prev, feature];
    });
    setTempRoute(null);
    setSelectedFeatureId(id);
  }, [overlayId, tempRoute]);

  const handleSaveTempRouteAsArea = useCallback(() => {
    if (!overlayId || !tempRoute || tempRoute.points.length < 3) return;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    setFeatures(prev => {
      const areaIndex = prev.filter(f => f.type === 'area').length + 1;
      const feature: OverlayFeature = {
        id,
        overlay_id: overlayId,
        type: 'area',
        geometry: [...tempRoute.points],
        label: `Area ${areaIndex}`,
        style: { ...DEFAULT_FEATURE_STYLE },
        created_at: now,
        updated_at: now,
      };
      return [...prev, feature];
    });
    setTempRoute(null);
    setSelectedFeatureId(id);
  }, [overlayId, tempRoute]);

  // ── Finish route/area ──
  // Called when the user toggles out of route/area mode. Routes auto-finalize
  // on mode change — there's no explicit Done button.
  const finishRoute = useCallback(() => {
    const ipId = inProgressFeatureId.current;
    const minPoints = drawMode === 'area' ? 3 : 2;
    if (ipId && inProgressGeometry.current.length >= minPoints) {
      setSelectedFeatureId(ipId);
    }
    resetInProgressDrawing();
  }, [drawMode, resetInProgressDrawing]);

  const handleSaveClick = useCallback(async () => {
    if (!overlayId || !user || !activeClinicId) return;
    let name = overlayName.trim();
    if (!name) {
      // Auto-default unnamed overlays to today's date so autosave doesn't need
      // a modal; user can rename via the tree afterwards.
      name = new Date().toISOString().slice(0, 10);
      setOverlayName(name);
    }

    // First save for this overlay → bulk writeOverlay. Lands the overlay
    // record + initial features in a single vault envelope (one fan-out per
    // recipient). Subsequent edits flip to per-feature envelopes via the diff
    // branch below so a 100-point overlay's drag-one-waypoint edit only
    // re-encrypts ~200 bytes per recipient instead of the whole features[].
    if (!overlayCreatedRef.current.has(overlayId)) {
      const saved = await writeOverlay({
        overlayId,
        clinicId: activeClinicId,
        name,
        center: mapCenter,
        zoom: mapZoom,
        features,
      });
      if (saved) {
        overlayCreatedRef.current.add(overlayId);
        lastSavedFeaturesRef.current = features;
        lastSavedMetadataRef.current = { name, center: mapCenter, zoom: mapZoom };
        setOverlays(prev => {
          const idx = prev.findIndex(o => o.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
      } else {
        setSaveError('Failed to save overlay');
      }
      return;
    }

    // Diff-based dispatch: compute feature add/change/remove sets against the
    // last-saved snapshot. Equality uses JSON serialisation — features are
    // small (~200 B) so the diff cost is dwarfed by a single network round.
    const prevFeatures = lastSavedFeaturesRef.current;
    const prevById = new Map(prevFeatures.map(f => [f.id, f]));
    const nextById = new Map(features.map(f => [f.id, f]));
    const toUpsert: OverlayFeature[] = [];
    for (const f of features) {
      const old = prevById.get(f.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(f)) toUpsert.push(f);
    }
    const toRemove: string[] = [];
    for (const f of prevFeatures) {
      if (!nextById.has(f.id)) toRemove.push(f.id);
    }

    // Serial awaits — each upsertFeature does a read/mutate/write on the same
    // IDB overlay row, so parallel calls would race the features[] update.
    for (const f of toUpsert) {
      await upsertFeature({ overlayId, clinicId: activeClinicId, feature: f });
    }
    for (const id of toRemove) {
      await removeFeature({ overlayId, clinicId: activeClinicId, featureId: id });
    }

    const meta = lastSavedMetadataRef.current;
    const metaChanged = !meta
      || meta.name !== name
      || meta.center[0] !== mapCenter[0]
      || meta.center[1] !== mapCenter[1]
      || meta.zoom !== mapZoom;
    if (metaChanged) {
      await writeOverlayMetadata({
        overlayId,
        clinicId: activeClinicId,
        name,
        center: mapCenter,
        zoom: mapZoom,
      });
    }

    lastSavedFeaturesRef.current = features;
    lastSavedMetadataRef.current = { name, center: mapCenter, zoom: mapZoom };
    setOverlays(prev => prev.map(o => o.id === overlayId
      ? { ...o, name, center: mapCenter, zoom: mapZoom, features, updated_at: new Date().toISOString() }
      : o));
    skipDirtyRef.current = true;
    setIsDirty(false);
  }, [overlayId, user, activeClinicId, overlayName, mapCenter, mapZoom, features, writeOverlay, upsertFeature, removeFeature, writeOverlayMetadata]);

  // Dirty watcher: any features change after the initial load flips draft mode
  // on. Save (via handleSaveClick) and Cancel (handleCancelDraft) both arm
  // skipDirtyRef so the resulting setFeatures doesn't re-flip it.
  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [features]);

  const handleCancelDraft = useCallback(() => {
    skipDirtyRef.current = true;
    setFeatures(lastSavedFeaturesRef.current);
    setSelectedFeatureId(null);
    setIsDirty(false);
  }, []);

  const handleRenameOverlay = useCallback(async (overlay: LocalMapOverlay, name: string) => {
    if (!user || !activeClinicId) return;
    const clinicId = overlay.clinic_id ?? activeClinicId;
    // Metadata-only envelope — no features[] re-encrypt per recipient.
    await writeOverlayMetadata({ overlayId: overlay.id, clinicId, name });
    const now = new Date().toISOString();
    setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, name, updated_at: now } : o));
    if (overlay.id === overlayId) {
      setOverlayName(name);
      // Keep the diff-baseline in sync so the next autosave doesn't re-fire
      // an unnecessary metadata update for a name we already pushed.
      if (lastSavedMetadataRef.current) {
        lastSavedMetadataRef.current = { ...lastSavedMetadataRef.current, name };
      }
    }
  }, [user, activeClinicId, overlayId, writeOverlayMetadata]);

  const handleSelectFeatureFromTree = useCallback((feature: OverlayFeature, sourceOverlayId: string) => {
    if (drawMode === 'route' || drawMode === 'area') return;
    const switching = sourceOverlayId !== overlayId;
    if (switching) {
      const target = overlays.find(o => o.id === sourceOverlayId);
      if (target) handleOpenOverlay(target as MapOverlay);
    }
    setSelectedFeatureId(feature.id);
    // Defer flyTo past handleOpenOverlay's 400ms fitBounds so this wins when switching
    if (feature.geometry.length > 0) {
      const [lat, lng] = feature.geometry[0];
      const delay = switching ? 450 : 0;
      setTimeout(() => mapRef.current?.flyTo(lat, lng), delay);
    }
  }, [drawMode, overlayId, overlays, handleOpenOverlay]);

  // Tour orchestrator hooks — let the guided Map tour drive selection and
  // settings without depending on click coordinates the tour can't compute.
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<{ featureId: string }>).detail;
      if (!detail?.featureId) return;
      for (const ov of overlays) {
        const found = ov.features.find(f => f.id === detail.featureId);
        if (found) {
          handleSelectFeatureFromTree(found, ov.id);
          return;
        }
      }
    };
    const onOpenSettings = () => setShowPopover(true);
    const onCloseSettings = () => setShowPopover(false);
    const onClearSelection = () => setSelectedFeatureId(null);
    const onOpenMobileTree = () => setShowMobileTree(true);
    const onCloseMobileTree = () => setShowMobileTree(false);
    window.addEventListener('tour:map-select-feature', onSelect);
    window.addEventListener('tour:map-open-settings', onOpenSettings);
    window.addEventListener('tour:map-close-settings', onCloseSettings);
    window.addEventListener('tour:map-clear-selection', onClearSelection);
    window.addEventListener('tour:map-open-mobile-tree', onOpenMobileTree);
    window.addEventListener('tour:map-close-mobile-tree', onCloseMobileTree);
    return () => {
      window.removeEventListener('tour:map-select-feature', onSelect);
      window.removeEventListener('tour:map-open-settings', onOpenSettings);
      window.removeEventListener('tour:map-close-settings', onCloseSettings);
      window.removeEventListener('tour:map-clear-selection', onClearSelection);
      window.removeEventListener('tour:map-open-mobile-tree', onOpenMobileTree);
      window.removeEventListener('tour:map-close-mobile-tree', onCloseMobileTree);
    };
  }, [overlays, handleSelectFeatureFromTree]);

  const handleUpdateSelectedFeature = useCallback((updated: OverlayFeature) => {
    setFeatures(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  // ── Feature click ──
  // Add vs Select are strictly separated: only `pan` (and `drag` for moving)
  // can open a feature's selection menu. Every Add mode either consumes the
  // tap as part of its own gesture or swallows it entirely — so a tap on an
  // existing waypoint while drawing a route never yanks focus into a select.
  const handleFeatureClick = useCallback((featureId: string) => {
    // Temp route active: tapping a waypoint appends its coord as the next
    // vertex (or closes the loop if it's the start, via handleMapClick's
    // SNAP_PX logic). Selection is suppressed so the route stays in focus.
    if (tempRoute) {
      const feature = features.find(f => f.id === featureId);
      if (feature && feature.geometry.length > 0) {
        const [lat, lng] = feature.geometry[0];
        handleMapClick(lat, lng);
        return;
      }
    }
    if (drawMode !== 'pan' && drawMode !== 'drag') {
      // Route / Area / Measure: forward the tap to the map-click handler at
      // the feature's anchor so the waypoint becomes the next vertex /
      // measure endpoint (existing SNAP_PX logic in handleMapClick snaps
      // cleanly because distance to the anchor is zero).
      // Pin / Track: swallow — dropping a new pin on top of an existing one,
      // or interpreting taps while a GPS track records, is noise.
      if (drawMode === 'route' || drawMode === 'area' || drawMode === 'measure') {
        const feature = features.find(f => f.id === featureId);
        if (feature && feature.geometry.length > 0) {
          const [lat, lng] = feature.geometry[0];
          handleMapClick(lat, lng);
        }
      }
      return;
    }
    setTempPoint(null);
    setSelectedFeatureId(prev => prev === featureId ? null : featureId);
  }, [drawMode, features, handleMapClick, tempRoute]);

  // ── Drag-driven geometry update (waypoint drag, route/area vertex drag) ──
  const handleFeatureGeometryChange = useCallback((featureId: string, geometry: [number, number][]) => {
    setFeatures(prev => prev.map(f => f.id === featureId
      ? { ...f, geometry, updated_at: new Date().toISOString() }
      : f
    ));
  }, []);

  // Insert a shaping vertex into a route at the segment closest to the click.
  // The new vertex lands between the two adjacent existing vertices, so the
  // user can then drag it to bend the line; without dragging it sits on the
  // existing line and changes nothing visible.
  const handleFeatureVertexInsert = useCallback((featureId: string, latlng: [number, number]) => {
    setFeatures(prev => prev.map(f => {
      if (f.id !== featureId || f.type !== 'route' || f.geometry.length < 2) return f;
      const insertAt = closestSegmentInsertIndex(f.geometry, latlng);
      const next = [...f.geometry.slice(0, insertAt), latlng, ...f.geometry.slice(insertAt)];
      return { ...f, geometry: next, updated_at: new Date().toISOString() };
    }));
  }, []);


  // ── Mode change ──
  // Selection is owned by feature taps, not mode toggles — mirrors Property edit toolbar.
  const handleModeChange = useCallback((mode: DrawMode) => {
    if ((drawMode === 'route' || drawMode === 'area') && inProgressFeatureId.current) {
      finishRoute();
    }
    // Tapping the active tool toggles back to pan — replaces the removed
    // close/cancel buttons with a re-tap-to-exit gesture.
    const next = mode === drawMode ? 'pan' : mode;
    setDrawMode(next);
    setMeasurePoints([]);
    setMeasureResult(null);
    if (next !== 'pan') setTempPoint(null);
    if (next !== 'pan') setTempRoute(null);
  }, [drawMode, finishRoute]);

  // Pencil toggle drives BOTH the feature editor's read/edit bifurcation AND
  // drawMode='drag' (geometry move) as one gesture. Save and Cancel inside
  // the editor exit both together — the user never juggles two orthogonal
  // toggles for "edit fields" vs "move the pin".
  const handleToggleFeatureEditMode = useCallback(() => {
    setIsFeatureEditMode(prev => {
      const next = !prev;
      if (next) {
        if (drawMode !== 'drag') handleModeChange('drag');
      } else if (drawMode === 'drag') {
        handleModeChange('drag');
      }
      return next;
    });
  }, [drawMode, handleModeChange]);

  const handleSaveAndExitEdit = useCallback(() => {
    handleSaveClick();
    setIsFeatureEditMode(false);
    if (drawMode === 'drag') handleModeChange('drag');
  }, [handleSaveClick, drawMode, handleModeChange]);

  const handleCancelAndExitEdit = useCallback(() => {
    handleCancelDraft();
    setIsFeatureEditMode(false);
    if (drawMode === 'drag') handleModeChange('drag');
  }, [handleCancelDraft, drawMode, handleModeChange]);

  // ── Delete selected ──
  const handleDeleteSelected = useCallback(() => {
    if (!selectedFeatureId) return;
    setConfirmDeleteFeature(selectedFeatureId);
  }, [selectedFeatureId]);

  const handleDeleteFeatureFromTree = useCallback((_overlayId: string, featureId: string) => {
    setConfirmDeleteFeature(featureId);
  }, []);

  const handleConfirmDeleteFeature = useCallback(async () => {
    const targetId = confirmDeleteFeature;
    setConfirmDeleteFeature(null);
    if (!targetId || !overlayId || !activeClinicId) return;

    // The delete ConfirmDialog *is* the save ceremony for this batch — commit
    // the removal now instead of leaving it in draft. Other pending features
    // stay dirty (lastSavedFeaturesRef carves the deleted id but keeps the
    // rest of the baseline intact, so a later Save still diffs correctly).
    const wasSaved = lastSavedFeaturesRef.current.some(f => f.id === targetId);
    const wasOverlayCreated = overlayCreatedRef.current.has(overlayId);
    if (wasSaved && wasOverlayCreated) {
      await removeFeature({ overlayId, clinicId: activeClinicId, featureId: targetId });
    }
    lastSavedFeaturesRef.current = lastSavedFeaturesRef.current.filter(f => f.id !== targetId);
    skipDirtyRef.current = true;
    setFeatures(prev => prev.filter(f => f.id !== targetId));
    setSelectedFeatureId(prev => (prev === targetId ? null : prev));
  }, [confirmDeleteFeature, overlayId, activeClinicId, removeFeature]);

  // ── Undo last vertex (route / area drawing) ──
  const handleUndoVertex = useCallback(() => {
    const ipId = inProgressFeatureId.current;
    if (!ipId || inProgressGeometry.current.length === 0) return;
    inProgressGeometry.current = inProgressGeometry.current.slice(0, -1);
    if (inProgressGeometry.current.length === 0) {
      setFeatures(prev => prev.filter(f => f.id !== ipId));
      resetInProgressDrawing();
      setSelectedFeatureId(null);
    } else {
      const now = new Date().toISOString();
      setFeatures(prev => prev.map(f =>
        f.id === ipId ? { ...f, geometry: [...inProgressGeometry.current], updated_at: now } : f
      ));
    }
  }, [resetInProgressDrawing]);

  // ── Search handler ──
  const handleSearchSubmit = useCallback(async () => {
    if (!searchQuery.trim() || searchPending) return;
    setSearchPending(true);
    const floor = new Promise(r => setTimeout(r, 600));
    try {
      const [result] = await Promise.all([resolveSearch(searchQuery), floor]);
      if (result) {
        // Low-confidence address geocodes land as a transient pin so the user
        // can confirm or dismiss via TempPointBody — avoids committing to a
        // miles-off centroid. Exact inputs (MGRS / UTM / lat-lng) have no
        // importance score and always commit straight to flyTo.
        const lowConfidence = result.importance != null && result.importance < 0.7;
        if (lowConfidence) {
          mapRef.current?.flyTo(result.lat, result.lng, 13);
          setTempPoint({ lat: result.lat, lng: result.lng });
        } else {
          mapRef.current?.flyTo(result.lat, result.lng, result.zoom);
        }
        pushRecent({
          query: searchQuery.trim(),
          label: result.label,
          lat: result.lat,
          lng: result.lng,
        });
        setSearchFocused(false);
        await new Promise(r => setTimeout(r, 800));
      }
    } finally {
      setSearchPending(false);
    }
  }, [searchQuery, searchPending, pushRecent]);

  const handleSearchOverlaySelect = useCallback((sel: SearchOverlaySelection) => {
    mapRef.current?.flyTo(sel.lat, sel.lng, 15);
    if (!sel.noPin) {
      setTempPoint({ lat: sel.lat, lng: sel.lng });
    }
    setSearchFocused(false);
    setSearchQuery('');
  }, []);

  // ── Map move tracking ──
  const handleMoveEnd = useCallback((center: [number, number], zoom: number) => {
    setMapCenter(center);
    setMapZoom(zoom);
  }, []);

  const isDrawInProgress = (drawMode === 'route' || drawMode === 'area') && inProgressFeatureId.current !== null;

  // Read-only features from other visible overlays (excludes the active overlay — those are editable)
  const visibleReadOnlyFeatures = overlays
    .filter(o => visibleOverlayIds.has(o.id) && o.id !== overlayId)
    .flatMap(o => o.features);

  // Hiding an overlay hides all of its features — including the active overlay's
  // editable layer. Without this gate the eye-toggle only affected other overlays.
  const activeOverlayHidden = overlayId != null && !visibleOverlayIds.has(overlayId);
  const renderedFeatures = activeOverlayHidden ? [] : features;

  const headerTitle = overlayName.trim() ? `Map · ${overlayName.trim()}` : 'Map';

  const searchInputEl = (
    <SearchInput
      value={searchQuery}
      onChange={setSearchQuery}
      onSubmit={handleSearchSubmit}
      onFocus={() => setSearchFocused(true)}
      placeholder="Address, grid, lat/lng…"
      className={isMobile ? '' : 'w-[260px]'}
    />
  );

  const drawerHeader = view === 'converter'
    ? {
        title: 'MGRS Converter',
        rightContent: (
          <HeaderPill>
            <PillButton icon={ChevronLeft} onClick={handleBack} label="Back to map" />
          </HeaderPill>
        ),
        hideDefaultClose: true,
      }
    : isMobile
      ? {
          title: '',
          rightContentFill: true,
          rightContent: (
            <div className="flex items-center w-full gap-2">
              <HeaderPill>
                <PillButton icon={Layers} onClick={() => setShowMobileTree(prev => !prev)} label="Overlays & settings" />
              </HeaderPill>
              <div className="flex-1 min-w-0">{searchInputEl}</div>
              <HeaderPill>
                <PillButton icon={X} onClick={onClose} label="Close" />
              </HeaderPill>
            </div>
          ),
          hideDefaultClose: true,
        }
      : {
          title: headerTitle,
        };

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={() => {
        if (isDirty && view === 'viewer') {
          setConfirmDiscardClose(true);
          return;
        }
        onClose();
      }}
      mobileFullScreen
      fullHeight="95dvh"
      desktopWidth="w-[90%]"
      header={drawerHeader}
    >
      <ContentWrapper slideDirection="">
        {/* ── Viewer ── */}
        {view === 'viewer' && (
          <div className="flex h-full relative">
          <MapSearchOverlay
            isVisible={searchFocused}
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onClose={() => setSearchFocused(false)}
            onSelect={handleSearchOverlaySelect}
            waypoints={[
              ...features.filter(f => f.type === 'waypoint'),
              ...visibleReadOnlyFeatures.filter(f => f.type === 'waypoint'),
            ]}
          />
          {/* Desktop left pane — search/layers row + overlay tree, mirrors CalendarDrawer rail */}
          {!isMobile && (
            <div className={`shrink-0 border-r border-primary/10 bg-themewhite3 flex flex-col transition-all duration-300 overflow-hidden ${
              (selectedFeature || tempPoint || tempRoute) ? 'w-0 opacity-0 border-r-0' : 'w-60 opacity-100'
            }`}>
              <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2 pb-1">
                <div data-tour="map-feature-search" className="flex-1 min-w-0">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSubmit={handleSearchSubmit}
                    onFocus={() => setSearchFocused(true)}
                    placeholder="Address, grid, lat/lng…"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPopover(prev => !prev)}
                  data-tour="map-settings-button"
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                    showPopover ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
                  }`}
                  aria-label="Map settings"
                  title="Map settings"
                >
                  <Settings size={17} />
                </button>
              </div>
              <MapOverlayTree
                overlays={overlays}
                activeOverlayId={overlayId}
                visibleOverlayIds={visibleOverlayIds}
                selectedFeatureId={selectedFeatureId}
                onMakeActive={(o) => handleOpenOverlay(o as MapOverlay)}
                onToggleVisible={handleToggleVisible}
                onRenameOverlay={handleRenameOverlay}
                onDeleteOverlay={handleDeleteOverlay}
                onSelectFeature={handleSelectFeatureFromTree}
                onNewOverlay={handleNewOverlay}
                tileMeta={tileMetaMap}
                downloadingId={downloadingId}
                onDownloadTiles={(o) => handleDownloadTiles(o as MapOverlay)}
                onEvictTiles={handleEvictTiles}
                linkedOverlayIds={linkedOverlayIds}
                onJumpToLinkedEvent={handleJumpToLinkedEvent}
                onOpenLinkPicker={handleOpenLinkPicker}
                onUnlinkEvent={handleUnlinkEvent}
                onOpenLinksEditor={handleOpenLinksEditor}
                onOpenFeatureLinksEditor={handleOpenFeatureLinksEditor}
                onDeleteFeature={handleDeleteFeatureFromTree}
              />
              <OverlayEventPicker
                isOpen={!!linkPicker}
                onClose={() => setLinkPicker(null)}
                anchorRect={linkPicker?.anchor ?? null}
                currentEventId={
                  linkPicker
                    ? (allEvents.find(e => e.structured_location?.overlay_id === linkPicker.overlayId)?.id ?? null)
                    : null
                }
                onPick={handlePickEventForLink}
                zIndex={1100}
              />
              <OverlayEventPicker
                isOpen={!!linksEditor}
                onClose={() => setLinksEditor(null)}
                anchorRect={linksEditor?.anchor ?? null}
                linkedEventIds={linkedEventIdsForOverlay}
                onToggle={handleToggleOverlayLink}
                title="Linked events (overlay)"
                zIndex={1100}
              />
              <OverlayEventPicker
                isOpen={!!featureLinksEditor}
                onClose={() => setFeatureLinksEditor(null)}
                anchorRect={featureLinksEditor?.anchor ?? null}
                linkedEventIds={linkedEventIdsForFeature}
                onToggle={handleToggleFeatureLink}
                title="Linked events (feature)"
                zIndex={1100}
              />
            </div>
          )}
          <div className="flex flex-col flex-1 min-w-0 relative">
            {/* Error feedback */}
            {saveError && (
              <div className={`px-4 pt-2 ${isMobile ? 'absolute top-16 left-0 right-0 z-[1002]' : ''}`}>
                <ErrorDisplay type="error" message={saveError} />
              </div>
            )}

            {/* Map area */}
            <div data-tour="map-canvas" className="flex-1 min-h-0 relative">
              <MapView
                ref={mapRef}
                features={renderedFeatures}
                drawMode={drawMode}
                selectedFeatureId={selectedFeatureId}
                selectedAnchor={
                  selectedFeature && selectedFeature.geometry.length > 0
                    ? { lat: selectedFeature.geometry[0][0], lng: selectedFeature.geometry[0][1] }
                    : null
                }
                onMapClick={handleMapClick}
                onLongPress={handleMapLongPress}
                onFeatureClick={handleFeatureClick}
                onFeatureGeometryChange={handleFeatureGeometryChange}
                onFeatureVertexInsert={handleFeatureVertexInsert}
                onMoveEnd={handleMoveEnd}
                gpsPosition={gpsPosition}
                showGrid={showGrid}
                controlsTopOffset={0}
                measurePoints={measurePoints}
                measureResult={measureResult}
                center={initialCenter ?? undefined}
                overlayId={overlayId ?? undefined}
                tilesCached={overlayId ? tileMetaMap.has(overlayId) : false}
                presenceMarkers={presenceMarkers}
                readOnlyFeatures={visibleReadOnlyFeatures}
                tempPoint={tempPoint}
                tempRoute={tempRoute}
                onTempRouteChange={handleTempRouteChange}
              />

              {/* ── Map settings (overlays + grid) — drawer/preview-overlay, calendar-settings pattern ── */}
              <MapSettingsDrawer
                isOpen={showPopover}
                onClose={() => setShowPopover(false)}
                showGrid={showGrid}
                onToggleGrid={() => setShowGrid(prev => !prev)}
              />
              <GeoPdfImportForm
                isOpen={geoPdfFormOpen}
                onClose={() => setGeoPdfFormOpen(false)}
                onSubmit={handleGeoPdfSubmit}
              />

              {/* ── Mobile: overlay tree drawer. Replaces the desktop left rail —
                  layers button in the header opens it; selecting an overlay/feature
                  closes it so the map stays visible. ── */}
              {isMobile && (
                <BaseDrawer
                  isVisible={showMobileTree}
                  onClose={() => setShowMobileTree(false)}
                  mobileOnly
                  mobileFullScreen
                  fullHeight="95dvh"
                  zIndex="z-[1010]"
                  header={{
                    title: 'Overlays & settings',
                    rightContent: (
                      <HeaderPill>
                        <PillButton icon={X} iconSize={18} onClick={() => setShowMobileTree(false)} label="Close" />
                      </HeaderPill>
                    ),
                    hideDefaultClose: true,
                  }}
                >
                  <div className="flex flex-col h-full min-h-0 overflow-auto">
                    <section>
                      <p className="px-4 pt-3 pb-1 text-[9pt] tracking-widest uppercase text-tertiary">Settings</p>
                      <MapSettingsBody
                        showGrid={showGrid}
                        onToggleGrid={() => setShowGrid(prev => !prev)}
                      />
                    </section>
                    <section>
                      <p className="px-4 pt-3 pb-1 text-[9pt] tracking-widest uppercase text-tertiary">Overlays</p>
                      <MapOverlayTree
                        overlays={overlays}
                        activeOverlayId={overlayId}
                        visibleOverlayIds={visibleOverlayIds}
                        selectedFeatureId={selectedFeatureId}
                        onMakeActive={(o) => { handleOpenOverlay(o as MapOverlay); setShowMobileTree(false); }}
                        onToggleVisible={handleToggleVisible}
                        onRenameOverlay={handleRenameOverlay}
                        onDeleteOverlay={handleDeleteOverlay}
                        onSelectFeature={(id) => { handleSelectFeatureFromTree(id); setShowMobileTree(false); }}
                        onNewOverlay={() => { handleNewOverlay(); setShowMobileTree(false); }}
                        tileMeta={tileMetaMap}
                        downloadingId={downloadingId}
                        onDownloadTiles={(o) => handleDownloadTiles(o as MapOverlay)}
                        onEvictTiles={handleEvictTiles}
                        linkedOverlayIds={linkedOverlayIds}
                        onJumpToLinkedEvent={(id) => { handleJumpToLinkedEvent(id); setShowMobileTree(false); }}
                        onOpenLinkPicker={handleOpenLinkPicker}
                        onUnlinkEvent={handleUnlinkEvent}
                        onOpenLinksEditor={handleOpenLinksEditor}
                        onOpenFeatureLinksEditor={(ov, fid, anchor) => { handleOpenFeatureLinksEditor(ov, fid, anchor); setShowMobileTree(false); }}
                        onDeleteFeature={(ov, fid) => { handleDeleteFeatureFromTree(ov, fid); setShowMobileTree(false); }}
                      />
                    </section>
                  </div>
                </BaseDrawer>
              )}

              {/* ── Mobile: selected-feature editor in a partial-height drawer.
                  Opens at 50% so the user can still see the map; drag up to expand. ── */}
              {isMobile && (
                <BaseDrawer
                  isVisible={!!selectedFeature}
                  onClose={() => setSelectedFeatureId(null)}
                  mobileOnly
                  fullHeight="90dvh"
                  peekPosition={25}
                  noBackdrop
                  noDragDismiss
                  zIndex="z-[1010]"
                  header={{
                    // Title shown in READ mode only. Edit mode hides the
                    // header title so the body TextInput is the single
                    // source of truth for the feature name.
                    title: isFeatureEditMode
                      ? ''
                      : (selectedFeature?.label
                        || (selectedFeature?.type === 'waypoint' ? 'Waypoint'
                          : selectedFeature?.type === 'route' ? 'Route'
                          : 'Area')),
                    leftContent: (
                      <HeaderPill>
                        <PillButton
                          icon={Pencil}
                          iconSize={18}
                          onClick={handleToggleFeatureEditMode}
                          label={isFeatureEditMode ? 'Exit edit mode' : 'Edit & move'}
                          circleBg={isFeatureEditMode ? 'bg-themeblue3 text-white' : undefined}
                        />
                      </HeaderPill>
                    ),
                    rightContent: (
                      <HeaderPill>
                        <PillButton icon={Trash2} iconSize={18} variant="danger" onClick={handleDeleteSelected} label="Delete" />
                        <PillButton icon={X} iconSize={18} onClick={() => setSelectedFeatureId(null)} label="Close" />
                      </HeaderPill>
                    ),
                    hideDefaultClose: true,
                  }}
                >
                  {selectedFeature && (
                    <FeatureEditor
                      feature={selectedFeature}
                      onUpdate={handleUpdateSelectedFeature}
                      waypoints={features.filter(f => f.type === 'waypoint')}
                      onFocusLeg={(bbox) => mapRef.current?.fitBounds(bbox)}
                      onStartNavigation={handleStartNavigation}
                      linkedEventCount={allEvents.reduce((n, e) => {
                        const explicit = e.linked_features?.some(f => f.overlay_id === selectedFeature.overlay_id && f.feature_id === selectedFeature.id)
                        const implied = e.linked_overlays?.includes(selectedFeature.overlay_id)
                        return n + (explicit || implied ? 1 : 0)
                      }, 0)}
                      onOpenLinksEditor={(anchor) => handleOpenFeatureLinksEditor(selectedFeature.overlay_id, selectedFeature.id, anchor)}
                      isDirty={isDirty}
                      onSave={handleSaveAndExitEdit}
                      onCancel={handleCancelAndExitEdit}
                      isEditMode={isFeatureEditMode}
                    />
                  )}
                </BaseDrawer>
              )}

              {/* ── Mobile: temp-point drawer. Transient — no feature is
                  committed until the user taps "Save as waypoint". ── */}
              {isMobile && (
                <BaseDrawer
                  isVisible={!!tempPoint && !selectedFeature}
                  onClose={handleCloseTempPoint}
                  mobileOnly
                  fullHeight="60dvh"
                  initialPosition={40}
                  noBackdrop
                  zIndex="z-[1010]"
                  header={{
                    title: 'Temp point',
                    rightContent: (
                      <HeaderPill>
                        <PillButton icon={Check} iconSize={18} onClick={handlePromoteTempPoint} label="Save as waypoint" accent="success" />
                        <PillButton
                          icon={Navigation}
                          iconSize={18}
                          onClick={() => tempPoint && handleStartNavigation(tempPoint.lat, tempPoint.lng, null)}
                          label="Navigate from here"
                          accent="info"
                        />
                        <PillButton icon={X} iconSize={18} onClick={handleCloseTempPoint} label="Close" />
                      </HeaderPill>
                    ),
                    hideDefaultClose: true,
                  }}
                >
                  {tempPoint && <TempPointBody lat={tempPoint.lat} lng={tempPoint.lng} />}
                </BaseDrawer>
              )}

              {/* ── Mobile: temp-route drawer (pin-to-pin navigation). Save
                  commits as a route feature; X discards. ── */}
              {isMobile && (
                <BaseDrawer
                  isVisible={!!tempRoute && !tempPoint && !selectedFeature}
                  onClose={handleCloseTempRoute}
                  mobileOnly
                  fullHeight="60dvh"
                  initialPosition={40}
                  noBackdrop
                  zIndex="z-[1010]"
                  header={{
                    title: 'Temp route',
                    rightContent: (
                      <HeaderPill>
                        {tempRoute && tempRoute.history.length > 0 && (
                          <PillButton
                            icon={Undo2}
                            iconSize={18}
                            onClick={handleUndoTempRoute}
                            label="Undo"
                          />
                        )}
                        {tempRoute && tempRoute.points.length >= 2 && (
                          <PillButton
                            icon={Check}
                            iconSize={18}
                            onClick={handleSaveTempRouteAsFeature}
                            label="Save as route"
                            accent="success"
                          />
                        )}
                        {tempRoute && tempRoute.points.length >= 3 && (
                          <PillButton
                            icon={Pentagon}
                            iconSize={18}
                            onClick={handleSaveTempRouteAsArea}
                            label="Save as area"
                            accent="success"
                          />
                        )}
                        <PillButton icon={X} iconSize={18} onClick={handleCloseTempRoute} label="Close" />
                      </HeaderPill>
                    ),
                    hideDefaultClose: true,
                  }}
                >
                  {tempRoute && <TempRouteBody points={tempRoute.points} closed={tempRoute.closed} onRemoveVertex={handleRemoveTempRouteVertex} onAddVertex={handleAddTempRouteVertex} />}
                </BaseDrawer>
              )}

              {/* ── Bottom-right: contextual stack + Add FAB ── */}
              <div className="absolute bottom-4 right-4 z-[1002] flex flex-col items-end gap-1.5 pb-[max(0rem,var(--sab,0px))] pointer-events-none">
                {/* Share toggle — only when overlay is linked to a mission event */}
                {linkedEvent && (
                  <button
                    type="button"
                    onClick={handleToggleSharing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10pt] font-medium
                      shadow-sm active:scale-95 transition-all pointer-events-auto
                      ${isSharing
                        ? 'bg-themegreen text-white'
                        : 'bg-themewhite border border-tertiary/20 text-tertiary'
                      }`}
                    title={isSharing ? 'Stop sharing position' : 'Share my position'}
                  >
                    <RadioTower size={13} className={isSharing ? 'animate-pulse' : ''} />
                    {isSharing ? 'Sharing' : 'Share'}
                  </button>
                )}

                {/* Undo last vertex — visible while drawing a route/area */}
                {isDrawInProgress && (
                  <button
                    onClick={handleUndoVertex}
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-themewhite border border-tertiary/20 text-tertiary hover:text-primary shadow-lg active:scale-95 transition-all pointer-events-auto"
                    title="Undo last vertex"
                  >
                    <Undo2 size={18} />
                  </button>
                )}

                {/* Pin glyph picker — 3 icons at a time with < / > chevrons.
                    Uses ActionPill chrome so its height matches ContextMenu's pill. */}
                {pinPickerPage !== null && (() => {
                  const pageCount = Math.ceil(PIN_GLYPHS.length / 3);
                  const page = Math.max(0, Math.min(pinPickerPage, pageCount - 1));
                  const glyphs = PIN_GLYPHS.slice(page * 3, page * 3 + 3);
                  return (
                    <ActionPill className="pointer-events-auto">
                      <button
                        onClick={() => setPinPickerPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary disabled:opacity-30 active:scale-95 transition-all"
                        aria-label="Previous icons"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {glyphs.map((wt) => {
                        const active = pinType === wt;
                        return (
                          <button
                            key={wt}
                            onClick={() => {
                              setPinType(wt);
                              handleModeChange('pin');
                              setPinPickerPage(null);
                            }}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                              active ? 'bg-themeblue3 text-white' : 'bg-themeblue2/8 text-primary'
                            }`}
                            title={WAYPOINT_LABELS[wt]}
                            aria-label={WAYPOINT_LABELS[wt]}
                          >
                            <WaypointIcon type={wt} color="currentColor" size={16} />
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setPinPickerPage(Math.min(pageCount - 1, page + 1))}
                        disabled={page >= pageCount - 1}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary disabled:opacity-30 active:scale-95 transition-all"
                        aria-label="Next icons"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </ActionPill>
                  );
                })()}

                {/* Add FAB — opens a context menu of create tools (Pin / Route / Area / Measure / Track).
                    Lights up + swaps glyph while a create mode is active; tap again to exit to pan. */}
                <button
                  data-tour="map-add-fab"
                  onClick={() => {
                    const inCreateMode = drawMode === 'pin' || drawMode === 'route' || drawMode === 'area' || drawMode === 'track' || drawMode === 'measure';
                    if (inCreateMode) {
                      handleModeChange('pan');
                      return;
                    }
                    setAddSheet('root');
                  }}
                  className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all pointer-events-auto bg-themeblue3 text-white"
                  title={
                    drawMode === 'pin' ? 'Exit pin mode'
                      : drawMode === 'route' ? 'Exit route mode'
                      : drawMode === 'area' ? 'Exit area mode'
                      : drawMode === 'track' ? 'Exit track mode'
                      : drawMode === 'measure' ? 'Exit measure mode'
                      : 'Add to map'
                  }
                >
                  {drawMode === 'pin' ? <MapPin className="w-5 h-5" />
                    : drawMode === 'route' ? <Route className="w-5 h-5" />
                    : drawMode === 'area' ? <Pentagon className="w-5 h-5" />
                    : drawMode === 'track' ? <Activity className="w-5 h-5" />
                    : drawMode === 'measure' ? <Ruler className="w-5 h-5" />
                    : <Plus className="w-5 h-5" />}
                  {recorder.status === 'recording' && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-themeredred animate-pulse" />
                  )}
                </button>
              </div>

              {/* Add ActionSheet — root condenses to 'New overlay', 'New feature', 'Import'.
                  Feature + Import each push to a nested sheet so the root stays short. */}
              {(() => {
                const rootOptions: ActionSheetOption[] = [
                  { key: 'new-overlay', label: 'New overlay', onAction: () => handleNewOverlay() },
                  { key: 'new-feature', label: 'New feature', onAction: () => setAddSheet('feature') },
                  { key: 'import', label: 'Import', onAction: () => setAddSheet('import') },
                ];
                const featureOptions: ActionSheetOption[] = [
                  {
                    key: 'pin',
                    label: 'Drop pin',
                    onAction: () => {
                      // Enter pin mode immediately with the current pinType so
                      // the user can tap-to-drop without first selecting an
                      // icon. The glyph picker still appears alongside the FAB
                      // for those who want to refine the icon before placing.
                      const idx = Math.max(0, PIN_GLYPHS.indexOf(pinType));
                      setPinPickerPage(Math.floor(idx / 3));
                      if (drawMode !== 'pin') handleModeChange('pin');
                    },
                  },
                  { key: 'route', label: 'Route', onAction: () => handleModeChange('route') },
                  { key: 'area', label: 'Area', onAction: () => handleModeChange('area') },
                  { key: 'measure', label: 'Measure', onAction: () => handleModeChange('measure') },
                  { key: 'track', label: 'Track GPS', onAction: () => handleModeChange('track') },
                ];
                const importOptions: ActionSheetOption[] = [
                  { key: 'import-gpx', label: 'GPX/KML', onAction: () => gpxKmlInputRef.current?.click() },
                  { key: 'import-geopdf', label: 'Geo-PDF', onAction: () => handleOpenGeoPdfForm() },
                  { key: 'import-mbtiles', label: 'MBTiles', onAction: () => mbtilesInputRef.current?.click() },
                ];
                const { title, options } = addSheet === 'feature'
                  ? { title: 'New feature', options: featureOptions }
                  : addSheet === 'import'
                    ? { title: 'Import', options: importOptions }
                    : { title: 'Add to map', options: rootOptions };
                return (
                  <ActionSheet
                    visible={addSheet !== null}
                    title={title}
                    options={options}
                    onClose={() => setAddSheet(null)}
                  />
                );
              })()}

              {/* Hidden file pickers — driven by Add context menu */}
              <input
                ref={gpxKmlInputRef}
                type="file"
                accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleImportFile(file);
                }}
                className="hidden"
              />
              <input
                ref={mbtilesInputRef}
                type="file"
                accept=".mbtiles,application/octet-stream"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleImportMBTiles(file);
                }}
                className="hidden"
              />

              {/* Search spinner overlay */}
              <animated.div
                className="absolute inset-0 z-[1002] flex items-center justify-center bg-themewhite dark:bg-themewhite"
                style={{ opacity: spinnerSpring.opacity, pointerEvents: searchPending ? 'auto' : 'none' }}
              >
                <LoadingSpinner size="lg" className="text-themeblue2" />
              </animated.div>

              {/* Track recorder card — visible while in track mode OR while a recording is in progress */}
              {(drawMode === 'track' || recorder.status !== 'idle') && (
                <div data-tour="map-track-recorder" className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3
                  bg-themewhite2/95 dark:bg-themewhite3/95 backdrop-blur-sm
                  px-3 py-2 rounded-lg shadow-sm">
                  <div className="relative w-10 h-10 rounded-full bg-themewhite shrink-0 flex items-center justify-center">
                    <Activity size={18} className={recorder.status === 'recording' ? 'text-themeredred' : 'text-themeblue3'} />
                    {recorder.status === 'recording' && (
                      <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-themeredred animate-pulse" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9pt] text-tertiary">
                      {recorder.status === 'idle' && 'Track recorder'}
                      {recorder.status === 'recording' && `Recording · ${recorder.points.length} pts`}
                      {recorder.status === 'paused' && `Paused · ${recorder.points.length} pts`}
                    </span>
                    <span className="text-[11pt] font-medium text-primary tabular-nums">
                      {recorder.distanceM >= 1000
                        ? `${(recorder.distanceM / 1000).toFixed(2)} km`
                        : `${Math.round(recorder.distanceM)} m`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-1">
                    {recorder.status === 'idle' && (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        disabled={!gpsPosition}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-themewhite bg-themeblue3 disabled:opacity-30 active:scale-95 transition-all"
                        aria-label="Start recording"
                        title={gpsPosition ? 'Start recording' : 'Waiting for GPS'}
                      >
                        <Play size={15} />
                      </button>
                    )}
                    {recorder.status === 'recording' && (
                      <button
                        type="button"
                        onClick={handlePauseRecording}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                        aria-label="Pause"
                        title="Pause"
                      >
                        <Pause size={15} />
                      </button>
                    )}
                    {recorder.status === 'paused' && (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-themewhite bg-themeblue3 active:scale-95 transition-all"
                        aria-label="Resume"
                        title="Resume"
                      >
                        <Play size={15} />
                      </button>
                    )}
                    {recorder.status !== 'idle' && (
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-themewhite bg-themeredred active:scale-95 transition-all"
                        aria-label="Stop and save"
                        title="Stop and save"
                      >
                        <Square size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Goto-waypoint card — shown when a waypoint is selected and not dismissed */}
              {selectedFeature
                && selectedFeature.type === 'waypoint'
                && selectedFeature.geometry.length > 0
                && gotoDismissedFor !== selectedFeature.id
                && drawMode !== 'measure' && (
                <GotoWaypointCard
                  label={selectedFeature.label || 'Waypoint'}
                  target={selectedFeature.geometry[0]}
                  gps={gpsPosition ? { lat: gpsPosition.lat, lng: gpsPosition.lng } : null}
                  onDismiss={() => setGotoDismissedFor(selectedFeature.id)}
                />
              )}

              {/* Measure readout */}
              {drawMode === 'measure' && measureResult && measurePoints.length === 2 && (
                <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3
                  bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm
                  px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-[10pt] font-medium text-primary">
                    {measureResult.distanceM >= 1000
                      ? `${(measureResult.distanceM / 1000).toFixed(2)} km`
                      : `${Math.round(measureResult.distanceM)} m`}
                  </span>
                  <span className="text-[10pt] font-mono text-themeblue2">
                    {formatBearing(
                      measureResult.bearing,
                      bearingReference,
                      (measurePoints[0][0] + measurePoints[1][0]) / 2,
                      (measurePoints[0][1] + measurePoints[1][1]) / 2,
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Desktop right pane — animated slide/collapse, mirrors CalendarPanel.
              Map column is flex-1 so it reflows as this pane opens/closes. */}
          {!isMobile && (
            <div className={`shrink-0 border-l border-primary/10 flex flex-col bg-themewhite3 transition-all duration-300 overflow-hidden ${
              (selectedFeature || tempPoint || tempRoute) ? 'w-[320px] opacity-100' : 'w-0 opacity-0 border-l-0'
            }`}>
              {!selectedFeature && tempPoint && (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-tertiary/10">
                    <div className="text-[10pt] font-semibold text-primary truncate flex-1 min-w-0">Temp point</div>
                    <HeaderPill>
                      <PillButton icon={Check} iconSize={18} onClick={handlePromoteTempPoint} label="Save as waypoint" accent="success" />
                      <PillButton
                        icon={Navigation}
                        iconSize={18}
                        onClick={() => handleStartNavigation(tempPoint.lat, tempPoint.lng, null)}
                        label="Navigate from here"
                        accent="info"
                      />
                      <PillButton icon={X} iconSize={18} onClick={handleCloseTempPoint} label="Close" />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TempPointBody lat={tempPoint.lat} lng={tempPoint.lng} />
                  </div>
                </div>
              )}
              {!selectedFeature && !tempPoint && tempRoute && (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-tertiary/10">
                    <div className="text-[10pt] font-semibold text-primary truncate flex-1 min-w-0">Temp route</div>
                    <HeaderPill>
                      <PillButton
                        icon={Undo2}
                        iconSize={18}
                        onClick={handleUndoTempRoute}
                        label="Undo"
                        disabled={tempRoute.history.length === 0}
                      />
                      <PillButton
                        icon={Check}
                        iconSize={18}
                        onClick={handleSaveTempRouteAsFeature}
                        label="Save as route"
                        accent="success"
                        disabled={tempRoute.points.length < 2}
                      />
                      <PillButton
                        icon={Pentagon}
                        iconSize={18}
                        onClick={handleSaveTempRouteAsArea}
                        label="Save as area"
                        accent="success"
                        disabled={tempRoute.points.length < 3}
                      />
                      <PillButton icon={X} iconSize={18} onClick={handleCloseTempRoute} label="Close" />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TempRouteBody points={tempRoute.points} onRemoveVertex={handleRemoveTempRouteVertex} onAddVertex={handleAddTempRouteVertex} />
                  </div>
                </div>
              )}
              {selectedFeature && (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-tertiary/10">
                    {/* READ-mode title in the desktop pane header — hidden in
                        edit mode so the body TextInput is the single source
                        of truth for the feature name. */}
                    {!isFeatureEditMode && (
                      <div className="flex-1 min-w-0 truncate text-[10pt] font-semibold text-primary">
                        {selectedFeature.label
                          || (selectedFeature.type === 'waypoint' ? 'Waypoint'
                            : selectedFeature.type === 'route' ? 'Route'
                            : 'Area')}
                      </div>
                    )}
                    {isFeatureEditMode && <div className="flex-1" />}
                    <HeaderPill>
                      <PillButton
                        icon={Pencil}
                        iconSize={18}
                        onClick={handleToggleFeatureEditMode}
                        label={isFeatureEditMode ? 'Exit edit mode' : 'Edit & move'}
                        circleBg={isFeatureEditMode ? 'bg-themeblue3 text-white' : undefined}
                      />
                      <PillButton icon={Trash2} iconSize={18} variant="danger" onClick={handleDeleteSelected} label="Delete" />
                      <PillButton icon={X} iconSize={18} onClick={() => setSelectedFeatureId(null)} label="Close" />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <FeatureEditor
                      feature={selectedFeature}
                      onUpdate={handleUpdateSelectedFeature}
                      waypoints={features.filter(f => f.type === 'waypoint')}
                      onFocusLeg={(bbox) => mapRef.current?.fitBounds(bbox)}
                      onStartNavigation={handleStartNavigation}
                      linkedEventCount={allEvents.reduce((n, e) => {
                        const explicit = e.linked_features?.some(f => f.overlay_id === selectedFeature.overlay_id && f.feature_id === selectedFeature.id)
                        const implied = e.linked_overlays?.includes(selectedFeature.overlay_id)
                        return n + (explicit || implied ? 1 : 0)
                      }, 0)}
                      onOpenLinksEditor={(anchor) => handleOpenFeatureLinksEditor(selectedFeature.overlay_id, selectedFeature.id, anchor)}
                      isDirty={isDirty}
                      onSave={handleSaveAndExitEdit}
                      onCancel={handleCancelAndExitEdit}
                      isEditMode={isFeatureEditMode}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          </div>
        )}

        {/* ── Converter view (chrome lives in BaseDrawer header) ── */}
        {view === 'converter' && (
          <div className="h-full overflow-y-auto px-4 py-4">
            <MGRSConverter
              onJumpToMap={(lat, lng) => {
                setView('viewer');
                setTimeout(() => mapRef.current?.flyTo(lat, lng, 15), 320);
              }}
            />
          </div>
        )}
      </ContentWrapper>
      <ConfirmDialog
        visible={!!confirmDeleteOverlayId}
        title="Delete overlay?"
        subtitle={(() => {
          const o = overlays.find(o => o.id === confirmDeleteOverlayId);
          const name = o?.name ? `“${o.name}” ` : '';
          return `${name}will be removed for every device in this clinic.`;
        })()}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDeleteOverlay}
        onCancel={() => setConfirmDeleteOverlayId(null)}
      />
      <ConfirmDialog
        visible={!!confirmDeleteFeature}
        title="Delete this feature?"
        subtitle="The overlay will re-sync to every device in this clinic."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDeleteFeature}
        onCancel={() => setConfirmDeleteFeature(null)}
      />
      <ConfirmDialog
        visible={confirmDiscardClose}
        title="Discard unsaved changes?"
        subtitle="Edits to this overlay haven't been saved. Closing now drops them."
        confirmLabel="Discard"
        variant="danger"
        onConfirm={() => {
          handleCancelDraft();
          setConfirmDiscardClose(false);
          performClose();
        }}
        onCancel={() => setConfirmDiscardClose(false)}
      />
    </BaseDrawer>
  );
}

export default MapOverlayPanel;
