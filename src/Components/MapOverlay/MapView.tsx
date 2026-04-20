import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { forward } from 'mgrs';
import { Plus, Minus, Info, Copy, ClipboardCheck, LocateFixed } from 'lucide-react';
import { useTheme } from '../../Utilities/ThemeContext';
import { createThemedTileLayer, TILE_THEME_LIGHT, TILE_THEME_DARK } from './ThemedTileLayer';
import { getTileFromCache } from '../../lib/mapTileService';
import { createMGRSGridLayer, GRID_THEME_LIGHT, GRID_THEME_DARK } from './MGRSGridLayer';
import type { OverlayFeature, DrawMode } from '../../Types/MapOverlayTypes';
import { waypointIconSvg } from './WaypointIcon';

export interface MapViewHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitBounds: (bbox: [number, number, number, number]) => void;
}

export interface PresenceMarker {
  userId: string
  lat: number
  lng: number
  /** ISO timestamp — drives staleness decay on render. */
  timestamp: string
  /** Display label — typically MGRS or a short name. */
  label?: string
}

interface MapViewProps {
  features: OverlayFeature[];
  drawMode: DrawMode;
  selectedFeatureId: string | null;
  onMapClick: (lat: number, lng: number) => void;
  onFeatureClick: (featureId: string) => void;
  gpsPosition: { lat: number; lng: number; accuracy: number } | null;
  showGrid?: boolean;
  center?: [number, number];
  zoom?: number;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  /** Extra top offset (px) for floating controls when header overlays the map */
  controlsTopOffset?: number;
  measurePoints?: [number, number][];
  measureResult?: { distanceM: number; bearing: number } | null;
  overlayId?: string;
  /** Only true when tiles for this overlay have actually been downloaded to IDB */
  tilesCached?: boolean;
  /** Live field positions for mission participants — rendered as decaying presence markers. */
  presenceMarkers?: PresenceMarker[];
}

const DEFAULT_CENTER: [number, number] = [38.8977, -77.0365];
const DEFAULT_ZOOM = 13;

const GPS_MARKER_STYLE = {
  radius: 7,
  color: '#2563EB',
  fillColor: '#3B82F6',
  fillOpacity: 1,
  weight: 2,
} as const;

const GPS_ACCURACY_STYLE = {
  color: '#3B82F6',
  fillColor: '#93C5FD',
  fillOpacity: 0.2,
  weight: 1,
} as const;

const SELECTED_WEIGHT_BOOST = 3;

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({
  features,
  drawMode,
  selectedFeatureId,
  onMapClick,
  onFeatureClick,
  gpsPosition,
  showGrid = true,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onMoveEnd,
  controlsTopOffset = 0,
  measurePoints,
  measureResult,
  overlayId,
  tilesCached = false,
  presenceMarkers,
}, ref) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.GridLayer | null>(null);
  const gridLayerRef = useRef<L.GridLayer | null>(null);
  const featureLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const gpsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const measureLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const presenceLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const [mgrsReadout, setMgrsReadout] = useState('');
  const [mgrsCopied, setMgrsCopied] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const attributionTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleZoomIn = useCallback(() => { mapRef.current?.zoomIn(); }, []);
  const handleZoomOut = useCallback(() => { mapRef.current?.zoomOut(); }, []);

  const gpsPositionRef = useRef(gpsPosition);
  useEffect(() => { gpsPositionRef.current = gpsPosition; }, [gpsPosition]);

  const handleRecenterGps = useCallback(() => {
    const pos = gpsPositionRef.current;
    if (!pos || !mapRef.current) return;
    mapRef.current.flyTo([pos.lat, pos.lng], Math.max(mapRef.current.getZoom(), 15), { duration: 1.0 });
  }, []);

  const toggleAttribution = useCallback(() => {
    setShowAttribution(prev => {
      if (!prev) {
        clearTimeout(attributionTimer.current);
        attributionTimer.current = setTimeout(() => setShowAttribution(false), 4000);
      }
      return !prev;
    });
  }, []);

  const updateMgrs = useCallback((map: L.Map) => {
    const c = map.getCenter();
    try {
      const mgrs = forward([c.lng, c.lat], 5);
      setMgrsReadout(mgrs);
    } catch {
      setMgrsReadout('---');
    }
  }, []);

  const handleCopyMgrs = useCallback(() => {
    if (mgrsReadout && mgrsReadout !== '---') {
      navigator.clipboard.writeText(mgrsReadout).then(() => {
        setMgrsCopied(true);
        setTimeout(() => setMgrsCopied(false), 1500);
      });
    }
  }, [mgrsReadout]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    const tileTheme = theme === 'dark' ? TILE_THEME_DARK : TILE_THEME_LIGHT;
    const tileLayer = createThemedTileLayer(tileTheme);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    const gridTheme = theme === 'dark' ? GRID_THEME_DARK : GRID_THEME_LIGHT;
    const gridLayer = createMGRSGridLayer(gridTheme);
    gridLayer.addTo(map);
    gridLayerRef.current = gridLayer;
    // Note: overlayId-aware tile cache is applied in the theme/overlayId effect below

    featureLayerRef.current.addTo(map);
    gpsLayerRef.current.addTo(map);
    presenceLayerRef.current.addTo(map);
    measureLayerRef.current.addTo(map);

    updateMgrs(map);

    map.on('moveend', () => {
      updateMgrs(map);
      if (onMoveEnd) {
        const c = map.getCenter();
        onMoveEnd([c.lat, c.lng], map.getZoom());
      }
    });

    mapRef.current = map;

    // Leaflet caches container size on init — re-measure after drawer animation settles
    const resizeTimer = setTimeout(() => map.invalidateSize(), 350);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap themed tile + grid layers when theme, showGrid, or overlayId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    if (gridLayerRef.current) map.removeLayer(gridLayerRef.current);

    const tileTheme = theme === 'dark' ? TILE_THEME_DARK : TILE_THEME_LIGHT;
    const tileCache = (overlayId && tilesCached)
      ? (z: number, x: number, y: number) => getTileFromCache(overlayId, z, x, y)
      : null;
    const tileLayer = createThemedTileLayer(tileTheme, tileCache);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    if (showGrid) {
      const gridTheme = theme === 'dark' ? GRID_THEME_DARK : GRID_THEME_LIGHT;
      const gridLayer = createMGRSGridLayer(gridTheme);
      gridLayer.addTo(map);
      gridLayerRef.current = gridLayer;
    } else {
      gridLayerRef.current = null;
    }
  }, [theme, showGrid, overlayId, tilesCached]);

  // Map click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };

    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [drawMode, onMapClick]);

  // Cursor style based on draw mode
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = drawMode === 'pin' || drawMode === 'route' || drawMode === 'area' || drawMode === 'measure' ? 'crosshair'
      : drawMode === 'delete' ? 'not-allowed'
      : drawMode === 'edit' ? 'pointer'
      : '';
  }, [drawMode]);

  // Sync features to map
  useEffect(() => {
    const group = featureLayerRef.current;
    group.clearLayers();

    for (const feature of features) {
      const isSelected = feature.id === selectedFeatureId;
      const baseWeight = feature.style.weight ?? 3;
      const weight = isSelected ? baseWeight + SELECTED_WEIGHT_BOOST : baseWeight;
      const color = feature.style.color;
      const opacity = feature.style.opacity ?? 1;
      const dashArray = feature.style.dash;

      if (feature.type === 'waypoint' && feature.geometry.length > 0) {
        const [lat, lng] = feature.geometry[0];
        const wptType = feature.waypoint_type ?? 'generic';
        const iconSize = isSelected ? 34 : 28;
        const svg = waypointIconSvg(wptType, color, iconSize, isSelected);

        const icon = L.divIcon({
          html: svg,
          className: '', // clear default leaflet-div-icon styling
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize / 2],
        });

        const marker = L.marker([lat, lng], { icon });

        if (feature.label) {
          marker.bindTooltip(feature.label, {
            permanent: true,
            direction: 'top',
            offset: [0, -iconSize / 2 - 4],
            className: 'leaflet-tooltip-tactical',
          });
        }

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onFeatureClick(feature.id);
        });

        group.addLayer(marker);
      }

      if (feature.type === 'route' && feature.geometry.length >= 2) {
        const latlngs = feature.geometry.map(([lat, lng]) => [lat, lng] as [number, number]);
        const line = L.polyline(latlngs, {
          color,
          weight,
          opacity,
          dashArray: dashArray ?? undefined,
        });

        if (feature.label) {
          line.bindTooltip(feature.label, { sticky: true, className: 'leaflet-tooltip-tactical' });
        }

        line.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onFeatureClick(feature.id);
        });

        group.addLayer(line);
      }

      if (feature.type === 'area' && feature.geometry.length >= 3) {
        const latlngs = feature.geometry.map(([lat, lng]) => [lat, lng] as [number, number]);
        const polygon = L.polygon(latlngs, {
          color,
          weight,
          opacity,
          fillColor: color,
          fillOpacity: 0.15,
          dashArray: dashArray ?? undefined,
        });

        if (feature.label) {
          polygon.bindTooltip(feature.label, { sticky: true, className: 'leaflet-tooltip-tactical' });
        }

        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onFeatureClick(feature.id);
        });

        group.addLayer(polygon);
      }
    }
  }, [features, selectedFeatureId, onFeatureClick]);

  // Sync GPS position
  useEffect(() => {
    const group = gpsLayerRef.current;
    group.clearLayers();

    if (!gpsPosition) return;

    const { lat, lng, accuracy } = gpsPosition;

    L.circle([lat, lng], {
      radius: accuracy,
      ...GPS_ACCURACY_STYLE,
    }).addTo(group);

    L.circleMarker([lat, lng], GPS_MARKER_STYLE).addTo(group);
  }, [gpsPosition]);

  // Sync presence markers — field positions from mission event's field_positions
  useEffect(() => {
    const group = presenceLayerRef.current;
    group.clearLayers();
    if (!presenceMarkers?.length) return;

    const now = Date.now();

    for (const marker of presenceMarkers) {
      const ageMs = now - new Date(marker.timestamp).getTime();
      const ageMin = ageMs / 60_000;
      const fillOpacity = Math.max(0.15, 0.9 - ageMin * 0.025);
      // Decay ring grows from 50m to 1000m over ~32 min
      const decayRadius = Math.min(1000, 50 + ageMin * 30);

      // Uncertainty ring
      L.circle([marker.lat, marker.lng], {
        radius: decayRadius,
        color: '#22C55E',
        fillColor: '#22C55E',
        fillOpacity: fillOpacity * 0.12,
        weight: 1,
        interactive: false,
      }).addTo(group);

      // Position dot
      const ageLabel = ageMin < 1 ? 'just now'
        : ageMin < 60 ? `${Math.round(ageMin)}m ago`
        : `${Math.round(ageMin / 60)}h ago`;

      L.circleMarker([marker.lat, marker.lng], {
        radius: 7,
        color: '#15803D',
        fillColor: '#22C55E',
        fillOpacity,
        weight: 2,
      }).bindTooltip(`${marker.label ?? 'Field'} · ${ageLabel}`, {
        direction: 'top',
        offset: [0, -10],
        className: 'leaflet-tooltip-tactical',
      }).addTo(group);
    }
  }, [presenceMarkers]);

  // Sync measure tool visualization
  useEffect(() => {
    const group = measureLayerRef.current;
    group.clearLayers();

    if (!measurePoints || measurePoints.length === 0) return;

    // Draw measure points as small circles
    for (const [lat, lng] of measurePoints) {
      L.circleMarker([lat, lng], {
        radius: 5,
        color: '#FFFFFF',
        fillColor: '#F59E0B',
        fillOpacity: 1,
        weight: 2,
      }).addTo(group);
    }

    // Draw dashed line between two points
    if (measurePoints.length === 2 && measureResult) {
      const line = L.polyline(measurePoints, {
        color: '#F59E0B',
        weight: 2,
        dashArray: '8 6',
        opacity: 0.9,
      });

      const distLabel = measureResult.distanceM >= 1000
        ? `${(measureResult.distanceM / 1000).toFixed(2)} km`
        : `${Math.round(measureResult.distanceM)} m`;
      const bearLabel = `${Math.round(measureResult.bearing)}°`;

      line.bindTooltip(`${distLabel} · ${bearLabel}`, {
        permanent: true,
        direction: 'center',
        className: 'leaflet-tooltip-measure',
      });

      group.addLayer(line);
    }
  }, [measurePoints, measureResult]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, z?: number) => {
      mapRef.current?.flyTo([lat, lng], z ?? mapRef.current.getZoom(), { duration: 1.2 });
    },
    fitBounds: (bbox: [number, number, number, number]) => {
      const [west, south, east, north] = bbox;
      mapRef.current?.fitBounds([[south, west], [north, east]], { padding: [40, 40], maxZoom: 15 });
    },
  }), []);

  const CTRL_BTN = 'w-9 h-9 rounded-lg flex items-center justify-center bg-themewhite2/90 dark:bg-themewhite3/90 text-primary shadow-sm active:scale-95 transition-all backdrop-blur-sm';

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ backgroundColor: theme === 'dark' ? 'rgb(15, 25, 35)' : 'rgb(240, 242, 245)' }}
      />

      {/* MGRS readout — top-left pill */}
      <button
        type="button"
        onClick={handleCopyMgrs}
        className="absolute left-3 z-[1000] flex items-center gap-1.5
          bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm
          text-primary text-xs font-mono px-2.5 py-1.5 rounded-lg shadow-sm
          active:scale-95 transition-all select-none"
        style={{ top: controlsTopOffset ? `${controlsTopOffset + 12}px` : 12 }}
        aria-label="Copy MGRS coordinate"
        role="status"
      >
        <span>{mgrsReadout || '---'}</span>
        {mgrsCopied
          ? <ClipboardCheck size={12} className="text-themegreen shrink-0" />
          : <Copy size={12} className="text-tertiary/50 shrink-0" />
        }
      </button>

      {/* Zoom + GPS controls — right side, vertically stacked */}
      <div className="absolute right-3 bottom-16 z-[1000] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleRecenterGps}
          disabled={!gpsPosition}
          className={`${CTRL_BTN} disabled:opacity-30`}
          aria-label="Center on my position"
        >
          <LocateFixed size={16} />
        </button>
        <button type="button" onClick={handleZoomIn} className={CTRL_BTN} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={handleZoomOut} className={CTRL_BTN} aria-label="Zoom out">
          <Minus size={16} />
        </button>
      </div>

      {/* Attribution — collapsed info icon, expands on tap */}
      <div className="absolute bottom-2 right-3 z-[1000] flex items-center gap-1.5">
        {showAttribution && (
          <span className="text-[10px] text-secondary/60 bg-themewhite2/80 dark:bg-themewhite3/80
            backdrop-blur-sm px-2 py-0.5 rounded-md animate-fadeIn">
            © OpenStreetMap contributors
          </span>
        )}
        <button
          type="button"
          onClick={toggleAttribution}
          className="w-6 h-6 rounded-full flex items-center justify-center
            bg-themewhite2/60 dark:bg-themewhite3/60 text-tertiary/40
            hover:text-tertiary/70 transition-colors"
          aria-label="Map attribution"
        >
          <Info size={12} />
        </button>
      </div>
    </div>
  );
});

export default MapView;
