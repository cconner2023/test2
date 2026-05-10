import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { ChevronLeft, Layers, Hand, Move, MapPin, Route, Pentagon, Trash2, X, Ruler, RadioTower, Undo2, Activity, Pause, Play, Square } from 'lucide-react';
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
import { DEFAULT_FEATURE_STYLE, WAYPOINT_LABELS } from '../../Types/MapOverlayTypes';
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
import { resolveSearch } from './searchResolver';
import { GotoWaypointCard } from './GotoWaypointCard';
import { parseGPX, serializeGPX } from '../../lib/gpx';
import { parseKML, serializeKML } from '../../lib/kml';
import { useTrackRecorder } from '../../lib/trackRecording';
import { deletePhoto, deletePhotosForFeatures } from '../../lib/mapPhotoService';
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
    // Capture feature ids before delete so we can purge their device-only
    // photos. Photos never sync, so this is the only chance to clean them up.
    const targetOverlay = overlays.find(o => o.id === id);
    const featureIds = targetOverlay ? targetOverlay.features.map(f => f.id) : [];
    const result = await deleteOverlay(id, user.id);
    if (result.ok) {
      setOverlays(prev => prev.filter(o => o.id !== id));
      if (featureIds.length > 0) deletePhotosForFeatures(featureIds);
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
  const handleFeatureClick = useCallback((featureId: string) => {
    // Lock selection while route/area drawing is active so taps on other
    // features can't yank focus away from the in-progress draw.
    if (drawMode === 'route' || drawMode === 'area') return;
    setSelectedFeatureId(prev => prev === featureId ? null : featureId);
  }, [drawMode]);

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
    // Purge any device-only photo attached to this feature.
    deletePhoto(selectedFeatureId);
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
                <PillButton icon={Layers} onClick={() => setShowPopover(prev => !prev)} label="Overlays" />
              </HeaderPill>
              <span className="flex-1 text-center text-sm font-semibold text-primary truncate">
                {headerTitle}
              </span>
              <HeaderPill>
                <PillButton icon={X} onClick={onClose} label="Close" />
              </HeaderPill>
            </div>
          ),
          hideDefaultClose: true,
          extraRow: (
            <div className="px-3 pb-2">{searchInputEl}</div>
          ),
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
            <div className="shrink-0 w-60 border-r border-primary/10 bg-themewhite3 flex flex-col">
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
                  <Layers size={17} />
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
                overlays={overlays}
                activeOverlayId={overlayId}
                visibleOverlayIds={visibleOverlayIds}
                onMakeActive={handleOpenOverlay}
                onToggleVisible={handleToggleVisible}
                onDelete={handleDeleteOverlay}
                onNewOverlay={handleNewOverlay}
                tileMeta={tileMetaMap}
                downloadingId={downloadingId}
                downloadProgress={downloadProgress}
                onDownloadTiles={handleDownloadTiles}
                onEvictTiles={handleEvictTiles}
                onImportFile={handleImportFile}
                onExportOverlay={handleExportOverlay}
                onImportMBTiles={handleImportMBTiles}
                mbtilesImportProgress={mbtilesProgress ?? geoPdfProgress}
                onImportGeoPdf={handleOpenGeoPdfForm}
                onDeleteImportedBasemap={handleDeleteImportedBasemap}
                showOverlays={isMobile}
              />
              <GeoPdfImportForm
                isOpen={geoPdfFormOpen}
                onClose={() => setGeoPdfFormOpen(false)}
                onSubmit={handleGeoPdfSubmit}
              />

              {/* ── FAB toolbar — always-expanded; mutations autosave on debounce ── */}
              <div className="absolute right-3 top-3 z-[1002] flex flex-col items-end">
                <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex items-center shadow-sm">
                  <button
                    onClick={() => handleModeChange('pan')}
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'pan' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title="Pan / select"
                  >
                    <Hand size={17} />
                  </button>
                  <button
                    onClick={() => handleModeChange('measure')}
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'measure' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title="Measure"
                  >
                    <Ruler size={17} />
                  </button>
                  <button
                    onClick={() => handleModeChange('pin')}
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'pin' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title="Drop pin"
                  >
                    <MapPin size={17} />
                  </button>
                  <button
                    onClick={() => handleModeChange('route')}
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'route' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title="Route"
                  >
                    <Route size={17} />
                  </button>
                  <button
                    onClick={() => handleModeChange('area')}
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'area' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title="Area"
                  >
                    <Pentagon size={17} />
                  </button>
                  <button
                    onClick={() => handleModeChange('track')}
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all relative ${drawMode === 'track' || recorder.status !== 'idle' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title="Record GPS track"
                  >
                    <Activity size={17} />
                    {recorder.status === 'recording' && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-themeredred animate-pulse" />
                    )}
                  </button>
                  {isDrawInProgress && (
                    <>
                      <div className="h-5 w-px shrink-0 bg-tertiary/15" />
                      <button
                        onClick={handleUndoVertex}
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                        title="Undo last vertex"
                      >
                        <Undo2 size={16} />
                      </button>
                    </>
                  )}
                  {selectedFeatureId && !isDrawInProgress && (
                    <>
                      <div className="h-5 w-px shrink-0 bg-tertiary/15" />
                      <button
                        onClick={() => handleModeChange('drag')}
                        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'drag' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                        title="Move selected"
                      >
                        <Move size={16} />
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                        title="Delete selected"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>

                {/* ── Pin glyph picker — appears under the toolbar while pin mode is active ── */}
                {drawMode === 'pin' && (
                  <div className="mt-1.5 rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex items-center shadow-sm">
                    {(['circle', 'cross', 'triangle'] as WaypointType[]).map((wt) => {
                      const active = pinType === wt;
                      return (
                        <button
                          key={wt}
                          type="button"
                          onClick={() => setPinType(wt)}
                          aria-label={WAYPOINT_LABELS[wt]}
                          title={WAYPOINT_LABELS[wt]}
                          className={`w-9 h-9 shrink-0 flex items-center justify-center active:scale-95 transition-all ${active ? 'text-themeblue2' : 'text-tertiary hover:text-primary'}`}
                        >
                          <WaypointIcon type={wt} color="currentColor" size={20} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── Inline feature menu — mirrors Property location-map menu ── */}
                {selectedFeature && (
                  <div className="mt-1.5 w-52 max-h-[60%] flex flex-col rounded-xl border border-tertiary/15 bg-themewhite shadow-md overflow-hidden">
                    <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-themewhite3/50 border-b border-primary/10">
                      <input
                        type="text"
                        value={selectedFeature.label}
                        onChange={(e) => handleUpdateSelectedFeature({ ...selectedFeature, label: e.target.value, updated_at: new Date().toISOString() })}
                        placeholder={selectedFeature.type === 'waypoint' ? 'Waypoint' : selectedFeature.type === 'route' ? 'Route' : 'Area'}
                        className="text-[9pt] font-medium text-primary truncate flex-1 min-w-0 bg-transparent focus:outline-none"
                      />
                      <button
                        onClick={() => setSelectedFeatureId(null)}
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                        aria-label="Close"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <FeatureEditor
                        feature={selectedFeature}
                        onUpdate={handleUpdateSelectedFeature}
                        waypoints={features.filter(f => f.type === 'waypoint')}
                        onFocusLeg={(bbox) => mapRef.current?.fitBounds(bbox)}
                      />
                    </div>
                  </div>
                )}

                {/* ── Share position toggle — only when overlay is linked to a mission event ── */}
                {linkedEvent && (
                  <button
                    type="button"
                    onClick={handleToggleSharing}
                    className={`mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10pt] font-medium
                      shadow-sm active:scale-95 transition-all
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

              </div>

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
