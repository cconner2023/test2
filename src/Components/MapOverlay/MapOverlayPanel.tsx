import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { ChevronLeft, Layers, Hand, MapPin, Route, Pentagon, Pencil, Trash2, Check, X, Ruler, RadioTower, Undo2 } from 'lucide-react';
import { LoadingSpinner } from '../LoadingSpinner';
import { forward } from 'mgrs';
import { BaseDrawer } from '../BaseDrawer';
import { HeaderPill, PillButton } from '../HeaderPill';
import { SearchInput } from '../SearchInput';
import { ContentWrapper } from '../ContentWrapper';
import { ErrorDisplay } from '../ErrorDisplay';
import { ActionPill } from '../ActionPill';
import { ActionButton } from '../ActionButton';
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
import type { OverlayFeature, DrawMode } from '../../Types/MapOverlayTypes';
import type { LocalMapOverlay, MapOverlay } from '../../Types/MapOverlayTypes';
import { DEFAULT_FEATURE_STYLE, WAYPOINT_LABELS } from '../../Types/MapOverlayTypes';
import MapView from './MapView';
import type { MapViewHandle, PresenceMarker } from './MapView';
import { useLocationPublisher } from '../../Hooks/useLocationPublisher';
import { useCalendarStore } from '../../stores/useCalendarStore';
import { MGRSConverter } from './MGRSConverter';
import { MapSettingsDrawer } from './MapSettingsDrawer';
import { FeatureEditor } from './FeatureEditor';
import { MapOverlayTree } from './MapOverlayTree';
import { resolveSearch } from './searchResolver';

type ViewState = 'viewer' | 'converter';

interface MapOverlayPanelProps {
  isVisible: boolean;
  onClose: () => void;
  initialOverlayId?: string | null;
}

const UI_TIMING = { FEEDBACK_DURATION: 4000 } as const;

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

function featureMgrs(feature: OverlayFeature): string {
  if (!feature.geometry.length) return '---';
  const [lat, lng] = feature.geometry[0];
  try {
    return forward([lng, lat], 4);
  } catch {
    return '---';
  }
}

export function MapOverlayPanel({ isVisible, onClose, initialOverlayId }: MapOverlayPanelProps) {
  const isMobile = useIsMobile();
  const { user, clinicId } = useAuth();

  const [view, setView] = useState<ViewState>('viewer');
  const [showPopover, setShowPopover] = useState(false);
  const [visibleOverlayIds, setVisibleOverlayIds] = useState<Set<string>>(new Set());
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState('');
  const [features, setFeatures] = useState<OverlayFeature[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>('pan');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Measure tool
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureResult, setMeasureResult] = useState<{ distanceM: number; bearing: number } | null>(null);

  // Clinic location auto-focus
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  // Overlay list + loading
  const [overlays, setOverlays] = useState<LocalMapOverlay[]>([]);
  const [loading, setLoading] = useState(false);

  // Save flow
  const [savingOverlayName, setSavingOverlayName] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [mapZoom, setMapZoom] = useState(4);

  // Two-tap discard confirmation — armed by first close-tap when unsaved changes exist
  const [discardArmed, setDiscardArmed] = useState(false);
  const discardArmTimer = useRef<number | null>(null);

  // Route/area drawing accumulation
  const inProgressGeometry = useRef<[number, number][]>([]);
  const inProgressFeatureId = useRef<string | null>(null);

  const resetInProgressDrawing = useCallback(() => {
    inProgressGeometry.current = [];
    inProgressFeatureId.current = null;
  }, []);

  // Snapshot of features at edit-mode entry — restored on Cancel
  const editEntrySnapshot = useRef<OverlayFeature[] | null>(null);

  // Flag: brand-new overlay needs to drop into edit mode after the first name-save
  const editAfterFirstSave = useRef(false);

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
  const allEvents = useCalendarStore(s => s.events);
  // Find the calendar event that owns this overlay (structured_location.overlay_id)
  const linkedEvent = overlayId
    ? (allEvents.find(e => e.structured_location?.overlay_id === overlayId) ?? null)
    : null;

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

  const [isEditing, setIsEditing] = useState(false);

  const selectedFeature = features.find(f => f.id === selectedFeatureId) ?? null;

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

  // ── Toolbar expand/collapse spring ──
  const toolbarSpring = useSpring({
    progress: isEditing ? 1 : 0,
    config: { tension: 260, friction: 26 },
  });

  // ── Spinner fade spring ──
  const spinnerSpring = useSpring({
    opacity: searchPending ? 1 : 0,
    config: { tension: 200, friction: 22 },
  });

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
    // New-overlay flow: prompt for name, then drop into edit mode on confirm
    editAfterFirstSave.current = true;
    setSavingOverlayName(true);
  }, [startWatching, initialCenter]);

  const handleOpenOverlay = useCallback((overlay: MapOverlay) => {
    setOverlayId(overlay.id);
    setOverlayName(overlay.name);
    setFeatures(overlay.features);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setSearchQuery('');
    setSavingOverlayName(false);
    editAfterFirstSave.current = false;
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
      );
      if (meta) {
        setTileMetaMap(prev => new Map(prev).set(overlay.id, meta));
      }
    } finally {
      setDownloadingId(null);
      setDownloadProgress(null);
    }
  }, [downloadingId]);

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
      stopWatching();
      setIsSharing(false);
      setDrawMode('pan');
      setSelectedFeatureId(null);
      setIsEditing(false);
      setSavingOverlayName(false);
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
        label: `${WAYPOINT_LABELS.generic} ${wptIndex}`,
        waypoint_type: 'generic',
        style: { ...DEFAULT_FEATURE_STYLE },
        created_at: now,
        updated_at: now,
      };
      setFeatures(prev => [...prev, feature]);
      setSelectedFeatureId(id);
      setDrawMode('pan');
      return;
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
  }, [drawMode, overlayId, measurePoints, features]);

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

  const handleSaveConfirm = useCallback(async () => {
    if (!overlayId || !user || !clinicId) return;
    const name = overlayName.trim();
    if (!name) return;

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
      setSavingOverlayName(false);
      // Brand-new overlay just got its name — drop into edit mode so the toolbar opens
      if (editAfterFirstSave.current) {
        editAfterFirstSave.current = false;
        editEntrySnapshot.current = features;
        setIsEditing(true);
      }
    } else {
      setSaveError(result.error);
    }
  }, [overlayId, user, clinicId, overlayName, mapCenter, mapZoom, features]);

  const handleSaveClick = useCallback(() => {
    if (!overlayName.trim()) {
      setSavingOverlayName(true);
      return;
    }
    handleSaveConfirm();
  }, [overlayName, handleSaveConfirm]);

  const handleToggleEditing = useCallback(() => {
    if (isEditing) {
      if ((drawMode === 'route' || drawMode === 'area') && inProgressFeatureId.current) {
        finishRoute();
      }
      // Save on close — batch changes
      handleSaveClick();
      setDrawMode('pan');
      setSelectedFeatureId(null);
      editEntrySnapshot.current = null;
    } else {
      editEntrySnapshot.current = features;
    }
    setIsEditing(prev => !prev);
  }, [isEditing, drawMode, features, finishRoute, handleSaveClick]);

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
  }, [overlayId, overlays, handleOpenOverlay]);

  const handleUpdateSelectedFeature = useCallback((updated: OverlayFeature) => {
    setFeatures(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  const handleCancelEditing = useCallback(() => {
    if (editEntrySnapshot.current) {
      setFeatures(editEntrySnapshot.current);
    }
    editEntrySnapshot.current = null;
    resetInProgressDrawing();
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setIsEditing(false);
    setDiscardArmed(false);
    if (discardArmTimer.current) {
      window.clearTimeout(discardArmTimer.current);
      discardArmTimer.current = null;
    }
  }, []);

  // Close (X) — warn on unsaved changes via two-tap arm
  const handleCloseEditing = useCallback(() => {
    const snapshot = editEntrySnapshot.current;
    const hasChanges = snapshot ? JSON.stringify(snapshot) !== JSON.stringify(features) : false;
    if (!hasChanges || discardArmed) {
      handleCancelEditing();
      return;
    }
    setDiscardArmed(true);
    if (discardArmTimer.current) window.clearTimeout(discardArmTimer.current);
    discardArmTimer.current = window.setTimeout(() => {
      setDiscardArmed(false);
      discardArmTimer.current = null;
    }, 3000);
  }, [features, discardArmed, handleCancelEditing]);

  // ── Feature click ──
  const handleFeatureClick = useCallback((featureId: string) => {
    setSelectedFeatureId(prev => prev === featureId ? null : featureId);
  }, []);

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
    setDrawMode(mode);
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

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      mobileFullScreen
      fullHeight="95dvh"
      desktopWidth="w-[90%]"
      header={undefined}
    >
      <ContentWrapper slideDirection="">
        {/* ── Viewer ── */}
        {view === 'viewer' && (
          <div className="flex h-full">
          {/* Desktop left pane — search + Layers + Close, then overlay tree */}
          {!isMobile && (
            <div className="shrink-0 w-[260px] border-r border-primary/10 bg-themewhite3 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-tertiary/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPopover(prev => !prev)}
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all
                    ${showPopover ? 'bg-themeblue3 text-white' : 'text-tertiary hover:bg-themewhite2'}`}
                  aria-label="Map settings"
                  title="Map settings"
                >
                  <Layers size={17} />
                </button>
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={handleSearchSubmit}
                  placeholder="Address, grid, lat/lng…"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:bg-themewhite2 active:scale-95 transition-all"
                  aria-label="Close"
                >
                  <X size={17} />
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

            {/* Mobile sub-header: layers + search + close, anchored over the map */}
            {isMobile && (
              <div className="absolute top-0 left-0 right-0 z-[1001] flex items-center gap-2 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))]">
                <HeaderPill>
                  <PillButton icon={Layers} onClick={() => setShowPopover(prev => !prev)} label="Overlays" />
                </HeaderPill>
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={handleSearchSubmit}
                  placeholder="Address, grid, or lat/lng..."
                  className="flex-1"
                />
                <HeaderPill>
                  <PillButton icon={X} onClick={handleBack} label="Close map" />
                </HeaderPill>
              </div>
            )}

            {/* Map area */}
            <div className="flex-1 min-h-0 relative">
              <MapView
                ref={mapRef}
                features={features}
                drawMode={isEditing || drawMode === 'measure' ? drawMode : 'pan'}
                selectedFeatureId={selectedFeatureId}
                onMapClick={handleMapClick}
                onFeatureClick={handleFeatureClick}
                onFeatureGeometryChange={handleFeatureGeometryChange}
                onFeatureVertexInsert={handleFeatureVertexInsert}
                onMoveEnd={handleMoveEnd}
                gpsPosition={gpsPosition}
                showGrid={showGrid}
                controlsTopOffset={isMobile ? 64 : 0}
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
                showOverlays={isMobile}
              />

              {/* ── FAB toolbar — Property-style floating pill, top-right of map ── */}
              <div
                className="absolute right-3 z-[1002] flex flex-col items-end"
                style={{ top: isMobile ? '72px' : '12px' }}
              >
                <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex items-center shadow-sm">
                  <animated.div
                    className="flex items-center overflow-hidden"
                    style={{
                      maxWidth: toolbarSpring.progress.to((p: number) => `${p * 360}px`),
                      opacity: toolbarSpring.progress,
                    }}
                  >
                    <button
                      onClick={() => handleModeChange('measure')}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'measure' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Measure"
                    >
                      <Ruler size={17} />
                    </button>
                    <button
                      onClick={() => handleModeChange('pin')}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'pin' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Drop pin"
                    >
                      <MapPin size={17} />
                    </button>
                    <button
                      onClick={() => handleModeChange('route')}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'route' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Route"
                    >
                      <Route size={17} />
                    </button>
                    <button
                      onClick={() => handleModeChange('area')}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'area' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Area"
                    >
                      <Pentagon size={17} />
                    </button>
                    {selectedFeatureId && (
                      <>
                        <div className="h-5 w-px shrink-0 bg-tertiary/15" />
                        <button
                          onClick={() => handleModeChange('drag')}
                          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'drag' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                          title="Drag selected"
                        >
                          <Hand size={17} />
                        </button>
                      </>
                    )}
                  </animated.div>

                  {/* Close — only while editing; two-tap arm if unsaved changes exist */}
                  {isEditing && (
                    <button
                      onClick={handleCloseEditing}
                      className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${discardArmed ? 'bg-themeredred text-white' : 'text-tertiary hover:text-themeredred'}`}
                      title={discardArmed ? 'Tap again to discard changes' : 'Close'}
                      aria-label={discardArmed ? 'Tap again to discard changes' : 'Close'}
                    >
                      <X size={18} />
                    </button>
                  )}

                  {/* Anchored edit/save toggle — always visible */}
                  <button
                    onClick={handleToggleEditing}
                    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isEditing ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title={isEditing ? 'Save' : 'Edit'}
                  >
                    {isEditing ? <Check size={18} /> : <Pencil size={18} />}
                  </button>
                </div>

                {/* ── Inline feature menu — mirrors Property location-map menu; opens on selection during edit session ── */}
                {selectedFeature && isEditing && (
                  <div className="mt-1.5 w-52 max-h-[60%] flex flex-col rounded-xl border border-tertiary/15 bg-themewhite shadow-md overflow-hidden">
                    <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-themewhite3/50 border-b border-primary/10">
                      <span className="text-[9pt] font-medium text-primary truncate flex-1 capitalize">
                        {selectedFeature.type} details
                      </span>
                      <button
                        onClick={() => setSelectedFeatureId(null)}
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                        aria-label="Close"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <FeatureEditor feature={selectedFeature} onUpdate={handleUpdateSelectedFeature} />
                    </div>
                    <div className="shrink-0 border-t border-primary/10 flex items-center justify-end px-3 py-2">
                      <ActionPill shadow="sm">
                        <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={handleDeleteSelected} />
                      </ActionPill>
                    </div>
                  </div>
                )}

                {/* ── Share position toggle — only when overlay is linked to a mission event ── */}
                {linkedEvent && (
                  <button
                    type="button"
                    onClick={() => setIsSharing(prev => !prev)}
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

                {/* ── Save naming modal — drops below FAB ── */}
                {savingOverlayName && (
                  <div className="mt-1.5 bg-themewhite rounded-xl shadow-lg w-56 p-3 border border-primary/10">
                    <p className="text-[10pt] font-medium text-primary mb-2">Name this overlay</p>
                    <input
                      type="text"
                      value={overlayName}
                      onChange={(e) => setOverlayName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveConfirm();
                        if (e.key === 'Escape') setSavingOverlayName(false);
                      }}
                      placeholder="e.g. Patrol Route Alpha"
                      className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-[10pt] text-primary
                        placeholder:text-tertiary/40 outline-none border border-tertiary/20 transition-all"
                      autoFocus
                    />
                    <div className="flex justify-end mt-2">
                      <ActionPill shadow="sm">
                        <ActionButton icon={X} label="Cancel" onClick={() => setSavingOverlayName(false)} />
                        <ActionButton
                          icon={Check}
                          label="Save"
                          variant={overlayName.trim() ? 'success' : 'disabled'}
                          onClick={handleSaveConfirm}
                        />
                      </ActionPill>
                    </div>
                  </div>
                )}
              </div>

              {/* Search spinner overlay */}
              <animated.div
                className="absolute inset-0 z-[1002] flex items-center justify-center bg-themewhite dark:bg-themewhite"
                style={{ opacity: spinnerSpring.opacity, pointerEvents: searchPending ? 'auto' : 'none' }}
              >
                <LoadingSpinner size="lg" className="text-themeblue2" />
              </animated.div>

              {/* Drawing menu — mirrors Property zone menu. Toggling away from
                  route/area mode (via the toolbar) auto-finalizes; no Done button. */}
              {isDrawInProgress && (
                <div className={`absolute left-3 z-[1000] w-52 flex flex-col rounded-xl border border-tertiary/15 bg-themewhite shadow-md overflow-hidden ${isMobile ? 'top-[72px]' : 'top-3'}`}>
                  <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-themewhite3/50 border-b border-primary/10">
                    <span className="text-[9pt] font-medium text-primary truncate flex-1 capitalize">
                      {drawMode === 'route' ? 'Drawing route' : 'Drawing area'}
                    </span>
                    <span className="text-[9pt] text-tertiary tabular-nums shrink-0">
                      {inProgressGeometry.current.length} pt
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center justify-end px-3 py-2">
                    <ActionPill shadow="sm">
                      <ActionButton icon={Undo2} label="Undo" onClick={handleUndoVertex} />
                    </ActionPill>
                  </div>
                </div>
              )}

              {/* Selected feature MGRS readout — view mode only; in-edit selection surfaces in the inline menu */}
              {selectedFeature && !isEditing && (
                <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2
                  bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm
                  px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-[10pt] font-medium text-primary truncate max-w-32">
                    {selectedFeature.label || 'Unnamed'}
                  </span>
                  <span className="text-[10pt] font-mono text-themeblue2">
                    {featureMgrs(selectedFeature)}
                  </span>
                </div>
              )}

              {/* Measure readout */}
              {drawMode === 'measure' && measureResult && (
                <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3
                  bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm
                  px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-[10pt] font-medium text-primary">
                    {measureResult.distanceM >= 1000
                      ? `${(measureResult.distanceM / 1000).toFixed(2)} km`
                      : `${Math.round(measureResult.distanceM)} m`}
                  </span>
                  <span className="text-[10pt] font-mono text-themeblue2">
                    {Math.round(measureResult.bearing)}° bearing
                  </span>
                </div>
              )}
            </div>
          </div>

          </div>
        )}

        {/* ── Converter view ── */}
        {view === 'converter' && (
          <div className="flex flex-col h-full">
            {isMobile ? (
              <div className="md:hidden sticky top-0 z-10 shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center backdrop-blur-xl bg-themewhite3/80">
                <HeaderPill>
                  <PillButton icon={ChevronLeft} onClick={handleBack} label="Back to map" />
                </HeaderPill>
                <p className="flex-1 text-sm font-medium text-primary truncate text-center mx-3">
                  MGRS Converter
                </p>
                <div className="w-12 shrink-0" />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1.5 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                  aria-label="Back to map"
                >
                  <ChevronLeft size={20} className="text-tertiary" />
                </button>
                <span className="text-sm font-medium text-primary">MGRS Converter</span>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <MGRSConverter />
            </div>
          </div>
        )}
      </ContentWrapper>
    </BaseDrawer>
  );
}

export default MapOverlayPanel;
