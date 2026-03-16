import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { ChevronLeft, Compass, Move, MapPin, Route, Pencil, Trash2, Check, X, Save } from 'lucide-react';
import { LoadingSpinner } from '../LoadingSpinner';
import { forward } from 'mgrs';
import { BaseDrawer } from '../BaseDrawer';
import { ContentWrapper } from '../Settings/ContentWrapper';
import { SearchInput } from '../SearchInput';
import { ErrorDisplay } from '../ErrorDisplay';
import { useGeolocation } from '../../Hooks/useGeolocation';
import { useAuth } from '../../Hooks/useAuth';
import { getOverlays, saveOverlay, deleteOverlay } from '../../lib/mapOverlayService';
import type { OverlayFeature, DrawMode } from '../../Types/MapOverlayTypes';
import type { LocalMapOverlay, MapOverlay } from '../../Types/MapOverlayTypes';
import { DEFAULT_FEATURE_STYLE, TACTICAL_COLORS } from '../../Types/MapOverlayTypes';
import MapView from './MapView';
import type { MapViewHandle } from './MapView';
import { MGRSConverter } from './MGRSConverter';
import { OverlayList } from './OverlayList';
import { FeatureEditor } from './FeatureEditor';
import { resolveSearch } from './searchResolver';

type ViewState = 'list' | 'viewer' | 'converter';

interface MapOverlayPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const UI_TIMING = { FEEDBACK_DURATION: 4000 } as const;

function featureMgrs(feature: OverlayFeature): string {
  if (!feature.geometry.length) return '---';
  const [lat, lng] = feature.geometry[0];
  try {
    return forward([lng, lat], 4);
  } catch {
    return '---';
  }
}

export function MapOverlayPanel({ isVisible, onClose }: MapOverlayPanelProps) {
  const { user, clinicId } = useAuth();

  const [view, setView] = useState<ViewState>('list');
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState('');
  const [features, setFeatures] = useState<OverlayFeature[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>('pan');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [showGrid] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Route drawing accumulation
  const inProgressGeometry = useRef<[number, number][]>([]);
  const inProgressFeatureId = useRef<string | null>(null);

  const mapRef = useRef<MapViewHandle>(null);
  const [searchPending, setSearchPending] = useState(false);

  const { position, startWatching, stopWatching } = useGeolocation();

  const gpsPosition = position
    ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy }
    : null;

  const [isEditing, setIsEditing] = useState(false);

  const selectedFeature = features.find(f => f.id === selectedFeatureId) ?? null;

  // ── Load overlays when panel becomes visible ──
  useEffect(() => {
    if (!isVisible || !clinicId) return;
    let cancelled = false;
    setLoading(true);
    getOverlays(clinicId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setOverlays(result.data);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isVisible, clinicId]);

  // ── Auto-clear save error ──
  useEffect(() => {
    if (!saveError) return;
    const t = setTimeout(() => setSaveError(null), UI_TIMING.FEEDBACK_DURATION);
    return () => clearTimeout(t);
  }, [saveError]);

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
    startWatching();
  }, [startWatching]);

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
    startWatching();
  }, [startWatching]);

  const handleDeleteOverlay = useCallback(async (id: string) => {
    if (!user) return;
    const result = await deleteOverlay(id, user.id);
    if (result.ok) {
      setOverlays(prev => prev.filter(o => o.id !== id));
    } else {
      setSaveError(result.error);
    }
  }, [user]);

  const handleOpenConverter = useCallback(() => {
    setView('converter');
  }, []);

  const handleBack = useCallback(() => {
    if (view === 'viewer') stopWatching();
    setView('list');
    setDrawMode('pan');
    setSelectedFeatureId(null);
    setNamingFeatureId(null);
    setEditingFeatureId(null);
    setIsEditing(false);
    setSavingOverlayName(false);
    inProgressGeometry.current = [];
    inProgressFeatureId.current = null;
  }, [view, stopWatching]);

  // ── Map click handler ──
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!overlayId) return;
    const now = new Date().toISOString();

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

    if (drawMode === 'pan') {
      setSelectedFeatureId(null);
      setEditingFeatureId(null);
    }
  }, [drawMode, overlayId]);

  // ── Finish route ──
  const finishRoute = useCallback(() => {
    const ipId = inProgressFeatureId.current;
    if (ipId && inProgressGeometry.current.length >= 2) {
      setSelectedFeatureId(ipId);
      setNamingFeatureId(ipId);
      setNameInput('');
    }
    inProgressGeometry.current = [];
    inProgressFeatureId.current = null;
    setDrawMode('pan');
  }, []);

  const handleToggleEditing = useCallback(() => {
    if (isEditing) {
      if (drawMode === 'route' && inProgressFeatureId.current) {
        finishRoute();
      }
      setDrawMode('pan');
      setSelectedFeatureId(null);
      setNamingFeatureId(null);
      setEditingFeatureId(null);
    }
    setIsEditing(prev => !prev);
  }, [isEditing, drawMode, finishRoute]);

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
    if (drawMode === 'route' && inProgressFeatureId.current) {
      finishRoute();
    }
    setDrawMode(mode);
    setSelectedFeatureId(null);
    setNamingFeatureId(null);
    setEditingFeatureId(null);
  }, [drawMode, finishRoute]);

  // ── Naming confirm ──
  const handleNameConfirm = useCallback(() => {
    if (!namingFeatureId) return;
    const label = nameInput.trim() || `WPT ${features.indexOf(features.find(f => f.id === namingFeatureId)!) + 1}`;
    setFeatures(prev => prev.map(f =>
      f.id === namingFeatureId ? { ...f, label, updated_at: new Date().toISOString() } : f
    ));
    setNamingFeatureId(null);
    setNameInput('');
  }, [namingFeatureId, nameInput, features]);

  const handleNameCancel = useCallback(() => {
    setNamingFeatureId(null);
    setNameInput('');
  }, []);

  // ── Delete selected ──
  const handleDeleteSelected = useCallback(() => {
    if (!selectedFeatureId) return;
    setFeatures(prev => prev.filter(f => f.id !== selectedFeatureId));
    setSelectedFeatureId(null);
  }, [selectedFeatureId]);

  // ── Save overlay ──
  const handleSaveClick = useCallback(() => {
    if (!overlayName.trim()) {
      setSavingOverlayName(true);
      return;
    }
    handleSaveConfirm();
  }, [overlayName]);

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

  const isRouteInProgress = drawMode === 'route' && inProgressFeatureId.current !== null;

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      fullHeight="95dvh"
      header={view === 'list' ? {
        title: 'Map Overlay',
        badge: 'BETA',
      } : undefined}
    >
      <ContentWrapper slideDirection="">
        {/* ── List view ── */}
        {view === 'list' && (
          <div className="flex flex-col h-full">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" className="text-themeblue3" />
              </div>
            ) : (
              <OverlayList
                overlays={overlays}
                onSelect={handleOpenOverlay}
                onDelete={handleDeleteOverlay}
                onNewOverlay={handleNewOverlay}
              />
            )}
            <div className="px-4 pb-6">
              <button
                type="button"
                onClick={handleOpenConverter}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                  border border-tertiary/15 bg-themewhite2 text-sm font-medium text-secondary
                  active:scale-95 transition-all duration-300"
              >
                <Compass size={16} />
                MGRS Converter
              </button>
            </div>
          </div>
        )}

        {/* ── Viewer ── */}
        {view === 'viewer' && (
          <div className="flex flex-col h-full">
            {/* Error feedback */}
            {saveError && (
              <div className="px-4 pt-2">
                <ErrorDisplay type="error" message={saveError} />
              </div>
            )}

            {/* Sub-header: back + search/spacer + toolbar pill */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-tertiary/10">
              <button
                type="button"
                onClick={handleBack}
                className="p-1.5 shrink-0 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                aria-label="Back to list"
              >
                <ChevronLeft size={20} className="text-tertiary" />
              </button>

              {/* Search — hidden when toolbar is expanded */}
              {!isEditing && (
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={handleSearchSubmit}
                  placeholder="Address, grid, or lat/lng..."
                  className="flex-1"
                />
              )}
              {isEditing && <div className="flex-1" />}

              {/* Toolbar pill — right side, expands leftward */}
              <div className="relative shrink-0">
                <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex items-center shadow-sm">
                  <animated.div
                    className="flex items-center overflow-hidden"
                    style={{
                      maxWidth: toolbarSpring.progress.to((p: number) => `${p * 260}px`),
                      opacity: toolbarSpring.progress,
                    }}
                  >
                    {/* Pan */}
                    <button
                      onClick={() => handleModeChange('pan')}
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'pan' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Pan"
                    >
                      <Move size={15} />
                    </button>
                    {/* Drop Pin */}
                    <button
                      onClick={() => handleModeChange('pin')}
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'pin' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Drop pin"
                    >
                      <MapPin size={15} />
                    </button>
                    {/* Route */}
                    <button
                      onClick={() => handleModeChange('route')}
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'route' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Route"
                    >
                      <Route size={15} />
                    </button>
                    <div className="h-5 w-px shrink-0 bg-tertiary/15" />
                    {/* Edit */}
                    <button
                      onClick={() => handleModeChange('edit')}
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${drawMode === 'edit' ? 'bg-themeyellow text-white' : 'text-tertiary hover:text-primary'}`}
                      title="Edit feature"
                    >
                      <Pencil size={15} />
                    </button>
                    {/* Delete — disabled until feature selected */}
                    <button
                      onClick={handleDeleteSelected}
                      disabled={!selectedFeatureId}
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none"
                      title="Delete selected"
                    >
                      <Trash2 size={15} />
                    </button>
                    <div className="h-5 w-px shrink-0 bg-tertiary/15" />
                    {/* Save */}
                    <button
                      onClick={handleSaveClick}
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                      title="Save overlay"
                    >
                      <Save size={15} />
                    </button>
                  </animated.div>

                  {/* Anchored edit/check toggle */}
                  <button
                    onClick={handleToggleEditing}
                    className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all ${isEditing ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                    title={isEditing ? 'Done' : 'Edit'}
                  >
                    {isEditing ? <Check size={18} /> : <Pencil size={18} />}
                  </button>
                </div>

                {/* ── Naming modal — drops below toolbar ── */}
                {namingFeatureId && (
                  <div className="absolute top-full right-0 mt-1.5 z-[1001] bg-themewhite rounded-xl shadow-lg w-56 p-3 border border-primary/10">
                    <p className="text-[10pt] font-medium text-primary mb-2">Name this point</p>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameConfirm();
                        if (e.key === 'Escape') handleNameCancel();
                      }}
                      placeholder="e.g. HLZ Eagle, CCP North"
                      className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-[10pt] text-primary
                        placeholder:text-tertiary/40 outline-none focus:border-themeblue2 focus:outline-none
                        border border-tertiary/20 transition-all"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleNameCancel}
                        className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleNameConfirm}
                        className="flex-1 py-1.5 rounded-lg bg-themeblue3 text-[10pt] text-white active:scale-95 transition-all"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Save naming modal — drops below toolbar ── */}
                {savingOverlayName && (
                  <div className="absolute top-full right-0 mt-1.5 z-[1001] bg-themewhite rounded-xl shadow-lg w-56 p-3 border border-primary/10">
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
                        placeholder:text-tertiary/40 outline-none focus:border-themeblue2 focus:outline-none
                        border border-tertiary/20 transition-all"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setSavingOverlayName(false)}
                        className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveConfirm}
                        className="flex-1 py-1.5 rounded-lg bg-themeblue3 text-[10pt] text-white active:scale-95 transition-all"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map area */}
            <div className="flex-1 min-h-0 relative">
              <MapView
                ref={mapRef}
                features={features}
                drawMode={isEditing ? drawMode : 'pan'}
                selectedFeatureId={selectedFeatureId}
                onMapClick={handleMapClick}
                onFeatureClick={handleFeatureClick}
                onMoveEnd={handleMoveEnd}
                gpsPosition={gpsPosition}
                showGrid={showGrid}
              />

              {/* Search spinner overlay */}
              <animated.div
                className="absolute inset-0 z-[1002] flex items-center justify-center bg-themewhite dark:bg-themewhite"
                style={{ opacity: spinnerSpring.opacity, pointerEvents: searchPending ? 'auto' : 'none' }}
              >
                <LoadingSpinner size="lg" className="text-themeblue3" />
              </animated.div>

              {/* Route finish button */}
              {isRouteInProgress && (
                <div className="absolute top-3 left-3 z-[1000]">
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
            </div>
          </div>
        )}

        {/* ── Converter view ── */}
        {view === 'converter' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
              <button
                type="button"
                onClick={handleBack}
                className="p-1.5 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                aria-label="Back to list"
              >
                <ChevronLeft size={20} className="text-tertiary" />
              </button>
              <span className="text-sm font-medium text-primary">MGRS Converter</span>
            </div>
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
