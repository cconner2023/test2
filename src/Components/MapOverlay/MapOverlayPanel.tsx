import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { ChevronLeft, Compass, Layers, Move, MapPin, Route, Pentagon, Pencil, Trash2, Check, X, Search, RefreshCw, Ruler, Wifi, RadioTower, Grid3X3, Undo2 } from 'lucide-react';
import { LoadingSpinner } from '../LoadingSpinner';
import { forward } from 'mgrs';
import { BaseDrawer } from '../BaseDrawer';
import { HeaderPill, PillButton } from '../HeaderPill';
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
import { DEFAULT_FEATURE_STYLE, TACTICAL_COLORS, WAYPOINT_LABELS } from '../../Types/MapOverlayTypes';
import MapView from './MapView';
import type { MapViewHandle, PresenceMarker } from './MapView';
import { useLocationPublisher } from '../../Hooks/useLocationPublisher';
import { useCalendarStore } from '../../stores/useCalendarStore';
import { MGRSConverter } from './MGRSConverter';
import { OverlayPopover as OverlayList } from './OverlayList';
import { FeatureEditor } from './FeatureEditor';
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

  // Naming modal
  const [namingFeatureId, setNamingFeatureId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Edit feature
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);

  // Waypoint type picker (shown after pin placement)
  const [pendingWaypointType, setPendingWaypointType] = useState<WaypointType>('generic');

  // Route/area drawing accumulation
  const inProgressGeometry = useRef<[number, number][]>([]);
  const inProgressFeatureId = useRef<string | null>(null);

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

  // Focus naming input when it appears
  useEffect(() => {
    if (namingFeatureId) nameInputRef.current?.focus();
  }, [namingFeatureId]);

  const handleNewOverlay = useCallback(() => {
    const id = crypto.randomUUID();
    setOverlayId(id);
    setOverlayName('');
    setFeatures([]);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setSearchQuery('');
    inProgressGeometry.current = [];
    inProgressFeatureId.current = null;
    setView('viewer');
    setShowPopover(false);
    setVisibleOverlayIds(prev => new Set([...prev, id]));
    startWatching();
    // Center on clinic location if resolved
    if (initialCenter) {
      setTimeout(() => mapRef.current?.flyTo(initialCenter[0], initialCenter[1], 12), 400);
    }
  }, [startWatching, initialCenter]);

  const handleOpenOverlay = useCallback((overlay: MapOverlay) => {
    setOverlayId(overlay.id);
    setOverlayName(overlay.name);
    setFeatures(overlay.features);
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setSearchQuery('');
    inProgressGeometry.current = [];
    inProgressFeatureId.current = null;
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
      setNamingFeatureId(null);
      setEditingFeatureId(null);
      setIsEditing(false);
      setSavingOverlayName(false);
      setMeasurePoints([]);
      setMeasureResult(null);
      inProgressGeometry.current = [];
      inProgressFeatureId.current = null;
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
      const feature: OverlayFeature = {
        id,
        overlay_id: overlayId,
        type: 'waypoint',
        geometry: [[lat, lng]],
        label: '',
        style: { ...DEFAULT_FEATURE_STYLE },
        created_at: now,
        updated_at: now,
      };
      setFeatures(prev => [...prev, feature]);
      setSelectedFeatureId(id);
      setNamingFeatureId(id);
      setNameInput('');
      setDrawMode('pan');
      return;
    }

    if (drawMode === 'route') {
      inProgressGeometry.current = [...inProgressGeometry.current, [lat, lng]];

      if (inProgressGeometry.current.length === 1) {
        const id = crypto.randomUUID();
        inProgressFeatureId.current = id;
        const feature: OverlayFeature = {
          id,
          overlay_id: overlayId,
          type: 'route',
          geometry: [...inProgressGeometry.current],
          label: '',
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
        const feature: OverlayFeature = {
          id,
          overlay_id: overlayId,
          type: 'area',
          geometry: [...inProgressGeometry.current],
          label: '',
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
      setEditingFeatureId(null);
    }
  }, [drawMode, overlayId, measurePoints]);

  // ── Finish route/area ──
  const finishRoute = useCallback(() => {
    const ipId = inProgressFeatureId.current;
    const minPoints = drawMode === 'area' ? 3 : 2;
    if (ipId && inProgressGeometry.current.length >= minPoints) {
      setSelectedFeatureId(ipId);
      setNamingFeatureId(ipId);
      setNameInput('');
    }
    inProgressGeometry.current = [];
    inProgressFeatureId.current = null;
    setDrawMode('pan');
  }, [drawMode]);

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
      setNamingFeatureId(null);
      setEditingFeatureId(null);
    }
    setIsEditing(prev => !prev);
  }, [isEditing, drawMode, finishRoute, handleSaveClick]);

  // ── Feature click ──
  const handleFeatureClick = useCallback((featureId: string) => {
    if (drawMode === 'delete') {
      setFeatures(prev => prev.filter(f => f.id !== featureId));
      setSelectedFeatureId(null);
      return;
    }
    if (drawMode === 'edit') {
      setEditingFeatureId(featureId);
      return;
    }
    setSelectedFeatureId(prev => prev === featureId ? null : featureId);
  }, [drawMode]);

  // ── Mode change ──
  const handleModeChange = useCallback((mode: DrawMode) => {
    if ((drawMode === 'route' || drawMode === 'area') && inProgressFeatureId.current) {
      finishRoute();
    }
    setDrawMode(mode);
    setSelectedFeatureId(null);
    setNamingFeatureId(null);
    setEditingFeatureId(null);
    setMeasurePoints([]);
    setMeasureResult(null);
  }, [drawMode, finishRoute]);

  // ── Naming confirm ──
  const handleNameConfirm = useCallback(() => {
    if (!namingFeatureId) return;
    const namingFeature = features.find(f => f.id === namingFeatureId);
    const defaultLabel = namingFeature?.type === 'waypoint'
      ? `${WAYPOINT_LABELS[pendingWaypointType]} ${features.filter(f => f.type === 'waypoint').indexOf(namingFeature!) + 1}`
      : namingFeature?.type === 'route'
        ? `Route ${features.filter(f => f.type === 'route').indexOf(namingFeature!) + 1}`
        : `Area ${features.filter(f => f.type === 'area').indexOf(namingFeature!) + 1}`;
    const label = nameInput.trim() || defaultLabel;
    setFeatures(prev => prev.map(f => {
      if (f.id !== namingFeatureId) return f;
      const updated = { ...f, label, updated_at: new Date().toISOString() };
      if (f.type === 'waypoint') updated.waypoint_type = pendingWaypointType;
      return updated;
    }));
    setNamingFeatureId(null);
    setNameInput('');
    setPendingWaypointType('generic');
  }, [namingFeatureId, nameInput, features, pendingWaypointType]);

  const handleNameCancel = useCallback(() => {
    setNamingFeatureId(null);
    setNameInput('');
    setPendingWaypointType('generic');
  }, []);

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
      inProgressFeatureId.current = null;
      setSelectedFeatureId(null);
    } else {
      const now = new Date().toISOString();
      setFeatures(prev => prev.map(f =>
        f.id === ipId ? { ...f, geometry: [...inProgressGeometry.current], updated_at: now } : f
      ));
    }
  }, []);

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

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      mobileFullScreen
      fullHeight="95dvh"
      header={undefined}
    >
      <ContentWrapper slideDirection="">
        {/* ── Viewer ── */}
        {view === 'viewer' && (
          <div className="flex flex-col h-full relative">
            {/* Error feedback */}
            {saveError && (
              <div className={`px-4 pt-2 ${isMobile ? 'absolute top-14 left-0 right-0 z-[1002]' : ''}`}>
                <ErrorDisplay type="error" message={saveError} />
              </div>
            )}

            {/* Sub-header: back + layers toggle + search */}
            <div className={
              isMobile
                ? 'absolute top-0 left-0 right-0 z-[1001] flex items-center gap-2 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))]'
                : 'flex items-center gap-2 px-3 py-2 border-b border-tertiary/10'
            }>
              {isMobile ? (
                <HeaderPill multi>
                  <PillButton icon={ChevronLeft} onClick={handleBack} label="Close map" />
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-xs font-medium text-primary truncate max-w-[6rem] pr-2 pl-0.5 active:opacity-60 transition-opacity"
                  >
                    {overlayName || 'New Overlay'}
                  </button>
                  {overlayId && tileMetaMap.has(overlayId) && (
                    <span className="pr-1.5" title="Tiles cached — available offline">
                      <Wifi size={13} className="text-themegreen" />
                    </span>
                  )}
                </HeaderPill>
              ) : (
                /* Layers toggle — desktop only, left of search */
                <button
                  type="button"
                  onClick={() => setShowPopover(prev => !prev)}
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all
                    ${showPopover ? 'bg-themeblue3 text-white' : 'text-tertiary hover:bg-themewhite2'}`}
                  aria-label="Overlays"
                  title="Overlays"
                >
                  <Layers size={17} />
                </button>
              )}

              {/* Mobile: Layers toggle */}
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowPopover(prev => !prev)}
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all
                    ${showPopover ? 'bg-themeblue3 text-white' : 'text-tertiary hover:bg-themewhite2'}`}
                  aria-label="Overlays"
                  title="Overlays"
                >
                  <Layers size={17} />
                </button>
              )}

              {/* Search — always full-width */}
              <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
                <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                  <Search size={16} className="absolute left-3 text-tertiary/50 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) handleSearchSubmit(); if (e.key === 'Escape') setSearchQuery('') }}
                    placeholder="Address, grid, or lat/lng..."
                    className="w-full bg-transparent outline-none text-[16px] text-tertiary pl-9 pr-3 py-2 rounded-full min-w-0 placeholder:text-tertiary/30 [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
                {searchQuery.trim() && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                    >
                      <X size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      disabled={searchPending}
                      className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                    >
                      {searchPending ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                    </button>
                  </>
                )}
              </div>

              {/* Close button — desktop only, right of search */}
              {!isMobile && (
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:bg-themewhite2 active:scale-95 transition-all"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
              )}
            </div>

            {/* Map area */}
            <div className="flex-1 min-h-0 relative">
              <MapView
                ref={mapRef}
                features={features}
                drawMode={isEditing || drawMode === 'measure' ? drawMode : 'pan'}
                selectedFeatureId={selectedFeatureId}
                onMapClick={handleMapClick}
                onFeatureClick={handleFeatureClick}
                onMoveEnd={handleMoveEnd}
                gpsPosition={gpsPosition}
                showGrid={showGrid}
                controlsTopOffset={isMobile ? 56 : 0}
                measurePoints={measurePoints}
                measureResult={measureResult}
                center={initialCenter ?? undefined}
                overlayId={overlayId ?? undefined}
                tilesCached={overlayId ? tileMetaMap.has(overlayId) : false}
                presenceMarkers={presenceMarkers}
              />

              {/* ── Overlay popover — anchored left, below sub-header ── */}
              {showPopover && (
                <div
                  className="absolute left-3 z-[1001]"
                  style={{ top: isMobile ? '68px' : '12px' }}
                >
                  <OverlayList
                    overlays={overlays}
                    activeOverlayId={overlayId}
                    visibleOverlayIds={visibleOverlayIds}
                    onMakeActive={handleOpenOverlay}
                    onToggleVisible={handleToggleVisible}
                    onDelete={handleDeleteOverlay}
                    onNewOverlay={handleNewOverlay}
                    onClose={() => setShowPopover(false)}
                    tileMeta={tileMetaMap}
                    downloadingId={downloadingId}
                    downloadProgress={downloadProgress}
                    onDownloadTiles={handleDownloadTiles}
                    onEvictTiles={handleEvictTiles}
                  />
                </div>
              )}

              {/* ── FAB toolbar — Property-style floating pill, top-right of map ── */}
              <div
                className="absolute right-3 z-[1002] flex flex-col items-end"
                style={{ top: isMobile ? '68px' : '12px' }}
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
                      onClick={() => handleModeChange('pan')}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'pan' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Pan"
                    >
                      <Move size={17} />
                    </button>
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
                    <button
                      onClick={() => handleModeChange('edit')}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'edit' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Edit feature"
                    >
                      <Pencil size={17} />
                    </button>
                    <div className="h-5 w-px shrink-0 bg-tertiary/15" />
                    <button
                      onClick={handleDeleteSelected}
                      disabled={!selectedFeatureId}
                      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none"
                      title="Delete selected"
                    >
                      <Trash2 size={17} />
                    </button>
                  </animated.div>

                  {/* Anchored edit/save toggle — always visible */}
                  <button
                    onClick={handleToggleEditing}
                    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isEditing ? 'bg-themegreen text-white' : 'text-tertiary hover:text-primary'}`}
                    title={isEditing ? 'Save' : 'Edit'}
                  >
                    {isEditing ? <Check size={18} /> : <Pencil size={18} />}
                  </button>
                </div>

                {/* ── Share position toggle — only when overlay is linked to a mission event ── */}
                {linkedEvent && (
                  <button
                    type="button"
                    onClick={() => setIsSharing(prev => !prev)}
                    className={`mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
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

                {/* ── MGRS grid toggle ── */}
                <button
                  type="button"
                  onClick={() => setShowGrid(prev => !prev)}
                  className={`mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                    shadow-sm active:scale-95 transition-all
                    ${showGrid
                      ? 'bg-themeblue3 text-white'
                      : 'bg-themewhite border border-tertiary/20 text-tertiary'
                    }`}
                  title={showGrid ? 'Hide MGRS grid' : 'Show MGRS grid'}
                >
                  <Grid3X3 size={13} />
                  Grid
                </button>

                {/* ── Naming modal — drops below FAB ── */}
                {namingFeatureId && (() => {
                  const namingFeature = features.find(f => f.id === namingFeatureId);
                  const isWaypoint = namingFeature?.type === 'waypoint';
                  const PICKER_TYPES: WaypointType[] = ['generic', 'hlz', 'ccp', 'casualty', 'contact'];
                  return (
                    <div className="mt-1.5 bg-themewhite rounded-xl shadow-lg w-56 p-3 border border-primary/10">
                      <p className="text-[10pt] font-medium text-primary mb-2">
                        {isWaypoint ? 'Name this point' : namingFeature?.type === 'route' ? 'Name this route' : 'Name this area'}
                      </p>
                      {isWaypoint && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          {PICKER_TYPES.map((wt) => (
                            <button
                              key={wt}
                              type="button"
                              onClick={() => setPendingWaypointType(wt)}
                              className={`px-2.5 py-1.5 rounded-lg text-[9pt] font-medium active:scale-95 transition-all
                                ${pendingWaypointType === wt ? 'bg-themeblue3 text-white' : 'bg-themewhite2 text-tertiary'}`}
                            >
                              {WAYPOINT_LABELS[wt]}
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleNameConfirm();
                          if (e.key === 'Escape') handleNameCancel();
                        }}
                        placeholder={isWaypoint ? 'e.g. HLZ Eagle, CCP North' : 'e.g. MSR Tampa, Sector 3'}
                        className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-[10pt] text-primary
                          placeholder:text-tertiary/40 outline-none border border-tertiary/20 transition-all"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={handleNameCancel} className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 active:scale-95 transition-all">
                          Cancel
                        </button>
                        <button onClick={handleNameConfirm} className="flex-1 py-1.5 rounded-lg bg-themeblue3 text-[10pt] text-white active:scale-95 transition-all">
                          Done
                        </button>
                      </div>
                    </div>
                  );
                })()}

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
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => setSavingOverlayName(false)} className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 active:scale-95 transition-all">
                        Cancel
                      </button>
                      <button onClick={handleSaveConfirm} className="flex-1 py-1.5 rounded-lg bg-themeblue3 text-[10pt] text-white active:scale-95 transition-all">
                        Save
                      </button>
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

              {/* Route/area finish + undo buttons */}
              {isDrawInProgress && (
                <div className={`absolute left-3 z-[1000] flex items-center gap-2 ${isMobile ? 'top-[68px]' : 'top-3'}`}>
                  <button
                    type="button"
                    onClick={handleUndoVertex}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-themewhite border border-tertiary/20
                      text-tertiary text-xs font-medium shadow-sm active:scale-95 transition-all"
                  >
                    <Undo2 size={12} />
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={finishRoute}
                    className="px-3 py-1.5 rounded-full bg-themeblue3 text-white text-xs font-medium
                      shadow-sm active:scale-95 transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* FeatureEditor — rendered inside map area container */}
              {drawMode === 'edit' && editingFeatureId && features.find(f => f.id === editingFeatureId) && (
                <FeatureEditor
                  feature={features.find(f => f.id === editingFeatureId)!}
                  onUpdate={(updated) => setFeatures(prev => prev.map(f => f.id === updated.id ? updated : f))}
                  onDelete={() => {
                    setFeatures(prev => prev.filter(f => f.id !== editingFeatureId));
                    setEditingFeatureId(null);
                    setDrawMode('pan');
                  }}
                  onClose={() => {
                    setEditingFeatureId(null);
                    setDrawMode('pan');
                  }}
                />
              )}

              {/* Selected feature MGRS readout */}
              {selectedFeature && !editingFeatureId && (
                <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2
                  bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm
                  px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-xs font-medium text-primary truncate max-w-32">
                    {selectedFeature.label || 'Unnamed'}
                  </span>
                  <span className="text-xs font-mono text-themeblue2">
                    {featureMgrs(selectedFeature)}
                  </span>
                </div>
              )}

              {/* Measure readout */}
              {drawMode === 'measure' && measureResult && (
                <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3
                  bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm
                  px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-xs font-medium text-primary">
                    {measureResult.distanceM >= 1000
                      ? `${(measureResult.distanceM / 1000).toFixed(2)} km`
                      : `${Math.round(measureResult.distanceM)} m`}
                  </span>
                  <span className="text-xs font-mono text-themeblue2">
                    {Math.round(measureResult.bearing)}° bearing
                  </span>
                </div>
              )}
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
