import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CalendarEvent } from '../../Types/CalendarTypes';
import { useSpring, animated } from '@react-spring/web';
import { ChevronLeft, ChevronRight, Settings, Move, MapPin, Route, Pentagon, Trash2, X, Ruler, RadioTower, Undo2, Activity, Pause, Play, Square, Plus, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ActionSheet, type ActionSheetOption } from '../ActionSheet';
import { ActionPill } from '../ActionPill';

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
import { useGeolocation } from '../../Hooks/useGeolocation';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { useAuth } from '../../Hooks/useAuth';
import { getOverlays, saveOverlay, deleteOverlay } from '../../lib/mapOverlayService';
import { loadCachedClinicUsers } from '../../lib/clinicUsersCache';
import {
  downloadTilesForOverlay,
  evictOverlayTiles,
  getAllTileMeta,
  computeOverlayBbox,
  type TileMetadata,
} from '../../lib/mapTileService';
import { getClinicDetails } from '../../lib/supervisorService';
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
import { MapSettingsDrawer } from './MapSettingsDrawer';
import { FeatureEditor } from './FeatureEditor';
import { MapOverlayTree } from './MapOverlayTree';
import { OverlayEventPicker } from './OverlayEventPicker';
import { useCalendarWrite } from '../../Hooks/useCalendarWrite';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { resolveSearch } from './searchResolver';
import { GotoWaypointCard } from './GotoWaypointCard';
import { parseGPX, serializeGPX } from '../../lib/gpx';
import { parseKML, serializeKML } from '../../lib/kml';
import { useTrackRecorder } from '../../lib/trackRecording';
import { registerAllImportedBasemaps, importMBTiles, deleteImportedBasemap, type MBTilesImportProgress } from '../../lib/mapImporters/mbtiles';
import { importGeoPdf, type GeoPdfImportProgress } from '../../lib/mapImporters/geopdf';
import { TILE_SOURCES } from '../../lib/mapTileService';
import { GeoPdfImportForm } from './GeoPdfImportForm';

type ViewState = 'viewer' | 'converter';

interface MapOverlayPanelProps {
  isVisible: boolean;
  onClose: () => void;
  initialOverlayId?: string | null;
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

export function MapOverlayPanel({ isVisible, onClose, initialOverlayId }: MapOverlayPanelProps) {
  const isMobile = useIsMobile();
  const { user, clinicId } = useAuth();
  const bearingReference = useMapPrefsStore(s => s.bearingReference);
  const basemapId = useMapPrefsStore(s => s.basemapId);

  const [view, setView] = useState<ViewState>('viewer');
  const [showPopover, setShowPopover] = useState(false);
  const [addSheet, setAddSheet] = useState<'root' | 'feature' | 'import' | null>(null);
  const [pinPickerPage, setPinPickerPage] = useState<number | null>(null);
  const [visibleOverlayIds, setVisibleOverlayIds] = useState<Set<string>>(new Set());
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState('');
  const [features, setFeatures] = useState<OverlayFeature[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>('pan');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [gotoDismissedFor, setGotoDismissedFor] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Autosave: debounced features-watcher. skipAutosaveRef suppresses the firing
  // immediately after handleOpenOverlay/handleNewOverlay populates features.
  const autosaveTimerRef = useRef<number | null>(null);
  const skipAutosaveRef = useRef(true);
  const flushAutosaveRef = useRef<() => void>(() => {});

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
    ? (allEvents.find(e => e.structured_location?.overlay_id === overlayId) ?? null)
    : null;

  // Inverse-link surface — overlay-id → linked CalendarEvent(s). Drives the
  // calendar chip on each overlay row and the link/unlink actions.
  const linkedOverlayIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of allEvents) {
      const id = e.structured_location?.overlay_id;
      if (id) ids.add(id);
    }
    return ids;
  }, [allEvents]);

  const { writeEvent } = useCalendarWrite();
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent);

  const [linkPicker, setLinkPicker] = useState<{ overlayId: string; anchor: DOMRect } | null>(null);

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
    if (!clinicId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getOverlays(clinicId), getAllTileMeta()]).then(([result, meta]) => {
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
          } else {
            handleNewOverlay();
          }
        } else if (loaded.length > 0) {
          const latest = loaded.reduce((best, o) =>
            new Date(o.updated_at) > new Date(best.updated_at) ? o : best
          );
          handleOpenOverlay(latest as MapOverlay);
        } else {
          handleNewOverlay();
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, clinicId]);

  // ── Auto-clear save error ──
  useEffect(() => {
    if (!saveError) return;
    const t = setTimeout(() => setSaveError(null), UI_TIMING.FEEDBACK_DURATION);
    return () => clearTimeout(t);
  }, [saveError]);

  // ── Resolve clinic location to coordinates for map default center ──
  useEffect(() => {
    if (!clinicId || initialCenter) return;
    let cancelled = false;
    getClinicDetails(clinicId).then(async (details) => {
      if (cancelled || !details.location) return;
      const result = await resolveSearch(details.location);
      if (cancelled || !result) return;
      setInitialCenter([result.lat, result.lng]);
    });
    return () => { cancelled = true; };
  }, [clinicId, initialCenter]);

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
      resetInProgressDrawing();
      setView('viewer');
      setShowPopover(false);
      setVisibleOverlayIds(prev => new Set([...prev, newId]));
      startWatching();
      // Allow autosave to persist on next features change (don't suppress).
      skipAutosaveRef.current = false;
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

  const handleNewOverlay = useCallback(() => {
    const id = crypto.randomUUID();
    setOverlayId(id);
    setOverlayName('');
    setFeatures([]);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setSearchQuery('');
    resetInProgressDrawing();
    setView('viewer');
    setShowPopover(false);
    setVisibleOverlayIds(prev => new Set([...prev, id]));
    startWatching();
    // Center on clinic location if resolved
    if (initialCenter) {
      setTimeout(() => mapRef.current?.flyTo(initialCenter[0], initialCenter[1], 12), 400);
    }
    // New-overlay flow: autosave names it on first feature mutation.
    skipAutosaveRef.current = true;
  }, [startWatching, initialCenter]);

  const handleOpenOverlay = useCallback((overlay: MapOverlay) => {
    setOverlayId(overlay.id);
    setOverlayName(overlay.name);
    setFeatures(overlay.features);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setSearchQuery('');
    skipAutosaveRef.current = true;
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

  const handleDeleteOverlay = useCallback(async (id: string) => {
    if (!user) return;
    const result = await deleteOverlay(id, user.id);
    if (result.ok) {
      setOverlays(prev => prev.filter(o => o.id !== id));
      // Evict cached tiles for deleted overlay (fire-and-forget)
      evictOverlayTiles(id).then(() => {
        setTileMetaMap(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      });
    } else {
      setSaveError(result.error);
    }
  }, [user]);

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

  const handleBack = useCallback(() => {
    if (view === 'viewer') {
      flushAutosaveRef.current();
      stopWatching();
      setIsSharing(false);
      setDrawMode('pan');
      setSelectedFeatureId(null);
      setMeasurePoints([]);
      setMeasureResult(null);
      resetInProgressDrawing();
      onClose();
    } else {
      setView('viewer');
    }
  }, [view, stopWatching, onClose]);

  // ── Map click handler ──
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!overlayId) return;
    const now = new Date().toISOString();

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
      const id = crypto.randomUUID();
      const wptIndex = features.filter(f => f.type === 'waypoint').length + 1;
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
      setFeatures(prev => [...prev, feature]);
      setSelectedFeatureId(id);
      setDrawMode('pan');
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
      setSelectedFeatureId(null);
    }
  }, [drawMode, overlayId, measurePoints, features, pinType]);

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
    if (!overlayId || !user || !clinicId) return;
    let name = overlayName.trim();
    if (!name) {
      // Auto-default unnamed overlays to today's date so autosave doesn't need
      // a modal; user can rename via the tree afterwards.
      name = new Date().toISOString().slice(0, 10);
      setOverlayName(name);
    }

    const result = await saveOverlay({
      overlayId,
      clinicId,
      userId: user.id,
      name,
      center: mapCenter,
      zoom: mapZoom,
      features,
    });

    if (result.ok) {
      setOverlays(prev => {
        const idx = prev.findIndex(o => o.id === result.data.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = result.data;
          return next;
        }
        return [...prev, result.data];
      });
    } else {
      setSaveError(result.error);
    }
  }, [overlayId, user, clinicId, overlayName, mapCenter, mapZoom, features]);

  // Autosave: debounce 600ms after the last features mutation. The first effect
  // run after open/new is suppressed via skipAutosaveRef so we don't echo-save.
  const flushAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      handleSaveClick();
    }
  }, [handleSaveClick]);

  useEffect(() => {
    flushAutosaveRef.current = flushAutosave;
  }, [flushAutosave]);

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    if (!overlayId || !user || !clinicId) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      handleSaveClick();
    }, 600);
  }, [features, overlayId, user, clinicId, handleSaveClick]);

  const handleRenameOverlay = useCallback(async (overlay: LocalMapOverlay, name: string) => {
    if (!user || !clinicId) return;
    const result = await saveOverlay({
      overlayId: overlay.id,
      clinicId,
      userId: user.id,
      name,
      center: overlay.center,
      zoom: overlay.zoom,
      features: overlay.features,
    });
    if (result.ok) {
      setOverlays(prev => prev.map(o => o.id === overlay.id ? result.data : o));
      if (overlay.id === overlayId) setOverlayName(name);
    } else {
      setSaveError(result.error);
    }
  }, [user, clinicId, overlayId]);

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

  const handleUpdateSelectedFeature = useCallback((updated: OverlayFeature) => {
    setFeatures(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  // ── Feature click ──
  // Add vs Select are strictly separated: only `pan` (and `drag` for moving)
  // can open a feature's selection menu. Every Add mode either consumes the
  // tap as part of its own gesture or swallows it entirely — so a tap on an
  // existing waypoint while drawing a route never yanks focus into a select.
  const handleFeatureClick = useCallback((featureId: string) => {
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
    setSelectedFeatureId(prev => prev === featureId ? null : featureId);
  }, [drawMode, features, handleMapClick]);

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
  }, [drawMode, finishRoute]);

  // ── Delete selected ──
  const handleDeleteSelected = useCallback(() => {
    if (!selectedFeatureId) return;
    setFeatures(prev => prev.filter(f => f.id !== selectedFeatureId));
    setSelectedFeatureId(null);
  }, [selectedFeatureId]);

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
        mapRef.current?.flyTo(result.lat, result.lng, result.zoom);
        await new Promise(r => setTimeout(r, 800));
      }
    } finally {
      setSearchPending(false);
    }
  }, [searchQuery, searchPending]);

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

  const headerTitle = overlayName.trim() ? `Map · ${overlayName.trim()}` : 'Map';

  const searchInputEl = (
    <SearchInput
      value={searchQuery}
      onChange={setSearchQuery}
      onSubmit={handleSearchSubmit}
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
                <PillButton icon={Settings} onClick={() => setShowPopover(prev => !prev)} label="Map settings" />
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
      onClose={onClose}
      mobileFullScreen
      fullHeight="95dvh"
      desktopWidth="w-[90%]"
      header={drawerHeader}
    >
      <ContentWrapper slideDirection="">
        {/* ── Viewer ── */}
        {view === 'viewer' && (
          <div className="flex h-full">
          {/* Desktop left pane — search/layers row + overlay tree, mirrors CalendarDrawer rail */}
          {!isMobile && (
            <div className={`shrink-0 border-r border-primary/10 bg-themewhite3 flex flex-col transition-all duration-300 overflow-hidden ${
              selectedFeature ? 'w-0 opacity-0 border-r-0' : 'w-60 opacity-100'
            }`}>
              <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2 pb-1">
                <div className="flex-1 min-w-0">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSubmit={handleSearchSubmit}
                    placeholder="Address, grid, lat/lng…"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPopover(prev => !prev)}
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
            <div className="flex-1 min-h-0 relative">
              <MapView
                ref={mapRef}
                features={features}
                drawMode={drawMode}
                selectedFeatureId={selectedFeatureId}
                onMapClick={handleMapClick}
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

              {/* ── Mobile: selected-feature editor in a partial-height drawer.
                  Opens at 50% so the user can still see the map; drag up to expand. ── */}
              {isMobile && (
                <BaseDrawer
                  isVisible={!!selectedFeature}
                  onClose={() => setSelectedFeatureId(null)}
                  mobileOnly
                  fullHeight="90dvh"
                  initialPosition={50}
                  zIndex="z-[1010]"
                  header={{
                    title: selectedFeature?.label
                      || (selectedFeature?.type === 'waypoint' ? 'Waypoint'
                        : selectedFeature?.type === 'route' ? 'Route'
                        : 'Area'),
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
                    />
                  )}
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

                {/* Move / delete — visible when a feature is selected */}
                {selectedFeatureId && !isDrawInProgress && (
                  <div className="flex items-center gap-1 rounded-full bg-themewhite border border-tertiary/20 px-0.5 py-0.5 shadow-lg pointer-events-auto">
                    <button
                      onClick={() => handleModeChange('drag')}
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                        drawMode === 'drag' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
                      }`}
                      title="Move selected"
                    >
                      <Move className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                      title="Delete selected"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
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
                      const idx = Math.max(0, PIN_GLYPHS.indexOf(pinType));
                      setPinPickerPage(Math.floor(idx / 3));
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
                <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3
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
              selectedFeature ? 'w-[320px] opacity-100' : 'w-0 opacity-0 border-l-0'
            }`}>
              {selectedFeature && (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-tertiary/10">
                    <input
                      type="text"
                      value={selectedFeature.label}
                      onChange={(e) => handleUpdateSelectedFeature({ ...selectedFeature, label: e.target.value, updated_at: new Date().toISOString() })}
                      placeholder={selectedFeature.type === 'waypoint' ? 'Waypoint' : selectedFeature.type === 'route' ? 'Route' : 'Area'}
                      className="text-[10pt] font-semibold text-primary truncate flex-1 min-w-0 bg-transparent focus:outline-none"
                    />
                    <HeaderPill>
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
    </BaseDrawer>
  );
}

export default MapOverlayPanel;
