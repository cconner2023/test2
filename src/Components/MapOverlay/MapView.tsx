import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { latLngToMgrs } from '../../lib/mgrsFormat';
import { Plus, Minus, Info, Copy, ClipboardCheck, LocateFixed, Map as MapIcon, Globe, Mountain, MountainSnow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PreviewOverlay } from '../PreviewOverlay';
import { BottomIsland } from '../BottomIsland';
import { ActionPill } from '../ActionPill';
import { useTheme } from '../../Utilities/ThemeContext';
import { createThemedTileLayer, getTileTheme } from './ThemedTileLayer';
import { getTileFromCache, getTileSource, TILE_SOURCES } from '../../lib/mapTileService';

const BASEMAP_ICONS: Record<string, LucideIcon> = {
  osm: MapIcon,
  'esri-imagery': Globe,
  opentopo: Mountain,
  'usgs-topo': MountainSnow,
};
import { createMGRSGridLayer, createLLGridLayer, getGridTheme } from './MGRSGridLayer';
import { MGRSGridLabels } from './MGRSGridLabels';
import type { OverlayFeature, DrawMode } from '../../Types/MapOverlayTypes';
import { resolveColor } from '../../Types/MapOverlayTypes';
import { waypointIconSvg } from './WaypointIcon';
import { FloorSelector } from './FloorSelector';
import { useMapPrefsStore } from '../../stores/useMapPrefsStore';
import { formatBearing } from '../../lib/declination';
import { latLngToUTM } from './utmProjection';

export interface MapViewHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitBounds: (bbox: [number, number, number, number]) => void;
  invalidateSize: () => void;
  /** Pixel distance between two lat/lngs at the current zoom — for waypoint snap. */
  containerDistancePx: (latA: number, lngA: number, latB: number, lngB: number) => number;
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
  onFeatureGeometryChange?: (featureId: string, geometry: [number, number][]) => void;
  /**
   * Fired when the user clicks an already-selected route's polyline (not a
   * vertex). The point is inserted between the two nearest existing vertices
   * to shape the line.
   */
  onFeatureVertexInsert?: (featureId: string, latlng: [number, number]) => void;
  gpsPosition: { lat: number; lng: number; accuracy: number } | null;
  showGrid?: boolean;
  center?: [number, number];
  zoom?: number;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  /** Extra top offset for floating controls when the header overlays the map.
   *  Number = px; string = any CSS length (e.g. a glass-header calc on mobile). */
  controlsTopOffset?: number | string;
  measurePoints?: [number, number][];
  measureResult?: { distanceM: number; bearing: number } | null;
  overlayId?: string;
  /** Only true when tiles for this overlay have actually been downloaded to IDB */
  tilesCached?: boolean;
  /** Live field positions for mission participants — rendered as decaying presence markers. */
  presenceMarkers?: PresenceMarker[];
  readOnlyFeatures?: OverlayFeature[];
  /** When set, the MGRS / lat-lng / UTM readout pill anchors to this point
   *  instead of the map center — used so the readout follows the currently
   *  selected feature without the user having to recenter the map. */
  selectedAnchor?: { lat: number; lng: number } | null;
  /** Fired on right-click (desktop) / long-press (mobile). Used by the panel
   *  to drop a pin at the gesture point regardless of draw mode. */
  onLongPress?: (lat: number, lng: number) => void;
  /** Transient marker for an uncommitted tap / long-press. Not a feature —
   *  promoted to a real waypoint only when the user accepts in the panel. */
  tempPoint?: { lat: number; lng: number } | null;
  /** Transient pin-to-pin navigation route. While present, renders a dashed
   *  polyline + hollow vertex dots. Saved as a real route feature via the
   *  temp-route drawer action. */
  tempRoute?: { points: [number, number][]; closed?: boolean } | null;
  /** Called on vertex dragend with the updated point list. */
  onTempRouteChange?: (points: [number, number][]) => void;
  /** Distinct floor levels present in the active overlay, ascending. The
   *  vertical floor rail is shown only when the overlay has depth (length > 1);
   *  flat overlays stay clean. New floors are added elsewhere (tree / feature
   *  editor), not on the rail. */
  floors?: number[];
  /** Active depth filter; `null` = all floors. Features whose `level` (??0)
   *  doesn't match the active floor are not rendered. */
  activeFloor?: number | null;
  onActiveFloorChange?: (floor: number | null) => void;
  /** Delete the active non-base floor (and its features) from the rail. */
  onDeleteFloor?: (level: number) => void;
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

function formatLegDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`;
}

function addVertexHandles(
  group: L.LayerGroup,
  featureId: string,
  geometry: [number, number][],
  color: string,
  onChange: (featureId: string, geometry: [number, number][]) => void,
) {
  geometry.forEach(([lat, lng], idx) => {
    const html = `<div style="width:12px;height:12px;border-radius:50%;background:#FFFFFF;border:2px solid ${color};box-shadow:0 1px 2px rgba(0,0,0,0.35);"></div>`;
    const icon = L.divIcon({ html, className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
    const handle = L.marker([lat, lng], { icon, draggable: true });
    handle.on('dragend', () => {
      const p = handle.getLatLng();
      const next = geometry.map(([la, ln], i) => i === idx ? [p.lat, p.lng] as [number, number] : [la, ln] as [number, number]);
      onChange(featureId, next);
    });
    group.addLayer(handle);
  });
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({
  features,
  drawMode,
  selectedFeatureId,
  onMapClick,
  onFeatureClick,
  onFeatureGeometryChange,
  onFeatureVertexInsert,
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
  readOnlyFeatures,
  selectedAnchor,
  onLongPress,
  tempPoint,
  tempRoute,
  onTempRouteChange,
  floors,
  activeFloor = null,
  onActiveFloorChange,
  onDeleteFloor,
}, ref) {
  const { theme, themeName } = useTheme();
  const bearingReference = useMapPrefsStore(s => s.bearingReference);
  const labelMode = useMapPrefsStore(s => s.labelMode);
  const coordDisplay = useMapPrefsStore(s => s.coordDisplay);
  const setCoordDisplay = useMapPrefsStore(s => s.setCoordDisplay);
  const basemapId = useMapPrefsStore(s => s.basemapId);
  const setBasemapId = useMapPrefsStore(s => s.setBasemapId);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.GridLayer | null>(null);
  const gridLayerRef = useRef<L.GridLayer | null>(null);
  const featureLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const readOnlyLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const gpsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const measureLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const tempPointLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const tempRouteLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const presenceLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const didInitCenterRef = useRef(false);
  const lastAppliedCenterRef = useRef<[number, number] | null>(null);
  // Set true around programmatic camera ops (init invalidateSize, async
  // center setView, imperative invalidateSize) so the moveend they emit is
  // not reported as a user pan — otherwise it pollutes the parent's tracked
  // mapCenter/mapZoom and makes an untouched overlay read as "changed".
  // Reset on the next frame (not consumed by moveend) so an op that emits no
  // moveend can't leave the flag stuck and swallow the next real pan.
  const programmaticMoveRef = useRef(false);
  const markProgrammaticMove = useCallback(() => {
    programmaticMoveRef.current = true;
    requestAnimationFrame(() => { programmaticMoveRef.current = false; });
  }, []);
  const [centerLatLng, setCenterLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [showAttribution, setShowAttribution] = useState(false);
  // Tracked separately so the label overlay re-renders once the map is ready.
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const attributionTimer = useRef<ReturnType<typeof setTimeout>>();

  // Coordinate readout overlay state — opened by tapping the MGRS pill.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showReadout, setShowReadout] = useState(false);
  const [readoutAnchor, setReadoutAnchor] = useState<DOMRect | null>(null);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<'mgrs' | 'utm' | 'latlng' | 'address' | null>(null);

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
    setCenterLatLng({ lat: c.lat, lng: c.lng });
  }, []);

  // Selected-feature anchor takes precedence over map center for the readout
  // pill + detail overlay, so the coordinate display follows the user's focus.
  const displayLatLng = selectedAnchor ?? centerLatLng;

  const mgrsReadout = displayLatLng
    ? (latLngToMgrs(displayLatLng.lat, displayLatLng.lng, 5) || '---')
    : '';

  const latLngText = displayLatLng
    ? `${displayLatLng.lat.toFixed(6)}, ${displayLatLng.lng.toFixed(6)}`
    : '';

  const utmText = displayLatLng
    ? (() => {
        try {
          const u = latLngToUTM(displayLatLng.lat, displayLatLng.lng);
          const e = Math.round(u.easting).toString().padStart(7, '0');
          const n = Math.round(u.northing).toString().padStart(7, '0');
          return `${u.zone}${u.northern ? 'N' : 'S'} ${e} ${n}`;
        } catch { return ''; }
      })()
    : '';

  const activeCoordText = coordDisplay === 'mgrs'
    ? (mgrsReadout || '---')
    : coordDisplay === 'utm'
      ? (utmText || '---')
      : (latLngText || '---');

  const handleOpenBasemapPicker = useCallback(() => {
    setShowBasemapPicker(true);
  }, []);

  const handleOpenReadout = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setReadoutAnchor(e.currentTarget.getBoundingClientRect());
    setShowReadout(true);
    setAddress('');
    const pos = selectedAnchor ?? centerLatLng;
    if (!pos) return;
    setAddressLoading(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`, {
      headers: { 'Accept-Language': 'en' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAddress(d?.display_name ?? ''))
      .catch(() => setAddress(''))
      .finally(() => setAddressLoading(false));
  }, [centerLatLng, selectedAnchor]);

  const handleCopyField = useCallback((value: string, field: 'mgrs' | 'utm' | 'latlng' | 'address') => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    const tileLayer = createThemedTileLayer(getTileTheme(themeName, theme), null, getTileSource(basemapId));
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    const gridFactory = coordDisplay === 'latlng' ? createLLGridLayer : createMGRSGridLayer;
    const gridLayer = gridFactory(getGridTheme(themeName, theme));
    gridLayer.addTo(map);
    gridLayerRef.current = gridLayer;
    // Note: overlayId-aware tile cache is applied in the theme/overlayId effect below

    featureLayerRef.current.addTo(map);
    readOnlyLayerRef.current.addTo(map);
    gpsLayerRef.current.addTo(map);
    presenceLayerRef.current.addTo(map);
    measureLayerRef.current.addTo(map);
    tempPointLayerRef.current.addTo(map);
    tempRouteLayerRef.current.addTo(map);

    updateMgrs(map);

    map.on('moveend', () => {
      updateMgrs(map);
      // Swallow the moveend emitted by a programmatic camera op — only real
      // user pan/zoom should update the parent's tracked center/zoom.
      if (programmaticMoveRef.current) return;
      if (onMoveEnd) {
        const c = map.getCenter();
        onMoveEnd([c.lat, c.lng], map.getZoom());
      }
    });

    mapRef.current = map;
    setMapInstance(map);
    didInitCenterRef.current = true;
    lastAppliedCenterRef.current = center;

    // Leaflet caches container size on init — re-measure after drawer animation settles
    const resizeTimer = setTimeout(() => {
      markProgrammaticMove();
      map.invalidateSize();
    }, 350);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply async-resolved `center` prop after init: parent often resolves the
  // clinic's lat/lng after MapView has already mounted with DEFAULT_CENTER, so
  // we must re-center when the prop changes. Skip when the map has already been
  // moved by the user or by fitBounds/flyTo (compare against the last value we
  // applied, not the live map center).
  useEffect(() => {
    if (!didInitCenterRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    const last = lastAppliedCenterRef.current;
    if (last && last[0] === center[0] && last[1] === center[1]) return;
    markProgrammaticMove();
    map.setView(center, zoom, { animate: false });
    lastAppliedCenterRef.current = center;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center]);

  // Swap themed tile + grid layers when theme, showGrid, or overlayId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    if (gridLayerRef.current) map.removeLayer(gridLayerRef.current);

    const tileCache = (overlayId && tilesCached)
      ? (z: number, x: number, y: number) => getTileFromCache(overlayId, z, x, y, basemapId)
      : null;
    const tileLayer = createThemedTileLayer(getTileTheme(themeName, theme), tileCache, getTileSource(basemapId));
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    if (showGrid) {
      const gridFactory = coordDisplay === 'latlng' ? createLLGridLayer : createMGRSGridLayer;
      const gridLayer = gridFactory(getGridTheme(themeName, theme));
      gridLayer.addTo(map);
      gridLayerRef.current = gridLayer;
    } else {
      gridLayerRef.current = null;
    }
  }, [theme, themeName, showGrid, overlayId, tilesCached, basemapId, coordDisplay]);

  // Map click handler — forwards every click (pan + draw modes alike) to the
  // panel, which decides what to do based on platform + drawMode (e.g. on
  // desktop a pan-mode click drops a pin; on mobile a pan-mode click is a no-op
  // because pin drop is bound to long-press instead).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [onMapClick]);

  // Long-press / right-click — Leaflet's `contextmenu` fires for both touch
  // long-press and desktop right-click, giving us one gesture that drops a pin
  // on every platform without colliding with single-tap selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onLongPress) return;
    const handler = (e: L.LeafletMouseEvent) => {
      onLongPress(e.latlng.lat, e.latlng.lng);
    };
    map.on('contextmenu', handler);
    return () => { map.off('contextmenu', handler); };
  }, [onLongPress]);

  // Cursor style based on draw mode
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = drawMode === 'pin' || drawMode === 'route' || drawMode === 'area' || drawMode === 'measure' ? 'crosshair'
      : drawMode === 'drag' ? 'grab'
      : '';
  }, [drawMode]);

  // Sync features to map
  useEffect(() => {
    const group = featureLayerRef.current;
    group.clearLayers();

    for (const feature of features) {
      // Depth filter: when a specific floor is targeted, hide features on
      // other floors entirely. `null` (All) renders everything — the legacy
      // behaviour for overlays without floors.
      if (activeFloor != null && (feature.level ?? 0) !== activeFloor) continue;

      const isSelected = feature.id === selectedFeatureId;
      const baseWeight = feature.style.weight ?? 3;
      const weight = isSelected ? baseWeight + SELECTED_WEIGHT_BOOST : baseWeight;
      const color = resolveColor(feature.style.color);
      const opacity = feature.style.opacity ?? 1;
      const dashArray = feature.style.dash;

      const isDraggable = isSelected && drawMode === 'drag';

      if (feature.type === 'waypoint' && feature.geometry.length > 0) {
        const [lat, lng] = feature.geometry[0];
        const iconSize = isSelected ? 32 : 24;
        const svg = waypointIconSvg(feature.waypoint_type, color, iconSize, isSelected, !!feature.tc3_card_id);

        const icon = L.divIcon({
          html: svg,
          className: '', // clear default leaflet-div-icon styling
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize / 2],
        });

        const marker = L.marker([lat, lng], { icon, draggable: isDraggable });

        if (feature.label && (labelMode === 'always' || isSelected)) {
          marker.bindTooltip(feature.label, {
            permanent: true,
            direction: 'top',
            offset: [0, -iconSize / 2],
            className: 'leaflet-tooltip-tactical',
          });
        }

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onFeatureClick(feature.id);
        });

        if (isDraggable && onFeatureGeometryChange) {
          marker.on('dragend', () => {
            const p = marker.getLatLng();
            onFeatureGeometryChange(feature.id, [[p.lat, p.lng]]);
          });
        }

        group.addLayer(marker);
      }

      if (feature.type === 'route' && feature.geometry.length >= 1) {
        // Render the polyline once we have at least two points; below that
        // the single starting vertex is shown via the draggable handle so
        // the first tap leaves a visible mark.
        if (feature.geometry.length >= 2) {
          const latlngs = feature.geometry.map(([lat, lng]) => [lat, lng] as [number, number]);
          const line = L.polyline(latlngs, {
            color,
            weight,
            opacity,
            dashArray: dashArray ?? '8 6',
          });

          if (feature.label) {
            const permanent = labelMode === 'always' || isSelected;
            line.bindTooltip(feature.label, permanent
              ? { permanent: true, direction: 'center', className: 'leaflet-tooltip-tactical' }
              : { sticky: true, className: 'leaflet-tooltip-tactical' });
          }

          line.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            // While the route is selected in drag/edit mode, taps on the
            // line itself insert a new shaping vertex at the click point.
            // Otherwise treat as a normal selection tap.
            if (isDraggable && onFeatureVertexInsert) {
              onFeatureVertexInsert(feature.id, [e.latlng.lat, e.latlng.lng]);
            } else {
              onFeatureClick(feature.id);
            }
          });

          group.addLayer(line);

          // Per-leg distance + azimuth labels at segment midpoints — selected route only
          if (isSelected) {
            for (let i = 0; i < feature.geometry.length - 1; i++) {
              const [aLat, aLng] = feature.geometry[i];
              const [bLat, bLng] = feature.geometry[i + 1];
              const { distanceM, bearing } = legGeometry(aLat, aLng, bLat, bLng);
              const midLat = (aLat + bLat) / 2;
              const midLng = (aLng + bLng) / 2;
              const distLabel = formatLegDistance(distanceM);
              const bearLabel = formatBearing(bearing, bearingReference, midLat, midLng);
              const html = `<div style="white-space:nowrap;font:500 10px/1 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,0.55);padding:2px 5px;border-radius:4px;transform:translate(-50%,-50%);">${distLabel} · ${bearLabel}</div>`;
              const icon = L.divIcon({ html, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
              const label = L.marker([midLat, midLng], { icon, interactive: false, keyboard: false });
              group.addLayer(label);
            }
          }
        }

        if (isDraggable && onFeatureGeometryChange) {
          addVertexHandles(group, feature.id, feature.geometry, color, onFeatureGeometryChange);
        }
      }

      if (feature.type === 'area' && feature.geometry.length >= 3) {
        const areaBaseWeight = feature.style.weight ?? 1.5;
        const areaWeight = isSelected ? areaBaseWeight + SELECTED_WEIGHT_BOOST : areaBaseWeight;
        const latlngs = feature.geometry.map(([lat, lng]) => [lat, lng] as [number, number]);
        const polygon = L.polygon(latlngs, {
          color,
          weight: areaWeight,
          opacity,
          fillColor: color,
          fillOpacity: 0.15,
          dashArray: dashArray ?? undefined,
        });

        if (feature.label) {
          const permanent = labelMode === 'always' || isSelected;
          polygon.bindTooltip(feature.label, permanent
            ? { permanent: true, direction: 'center', className: 'leaflet-tooltip-tactical' }
            : { sticky: true, className: 'leaflet-tooltip-tactical' });
        }

        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onFeatureClick(feature.id);
        });

        group.addLayer(polygon);

        if (isDraggable && onFeatureGeometryChange) {
          addVertexHandles(group, feature.id, feature.geometry, color, onFeatureGeometryChange);
        }
      }
    }
  }, [features, selectedFeatureId, drawMode, onFeatureClick, onFeatureGeometryChange, onFeatureVertexInsert, bearingReference, labelMode, activeFloor]);

  // Sync read-only features (visible but non-active overlays)
  useEffect(() => {
    const group = readOnlyLayerRef.current;
    group.clearLayers();

    for (const feature of (readOnlyFeatures ?? [])) {
      const color = resolveColor(feature.style.color);
      const baseWeight = feature.style.weight ?? 3;
      const dashArray = feature.style.dash;

      if (feature.type === 'waypoint' && feature.geometry.length > 0) {
        const [lat, lng] = feature.geometry[0];
        const svg = waypointIconSvg(feature.waypoint_type, color, 22, false, !!feature.tc3_card_id);
        const icon = L.divIcon({
          html: svg,
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([lat, lng], { icon });
        marker.setOpacity(0.4);
        if (feature.label && labelMode === 'always') {
          marker.bindTooltip(feature.label, {
            permanent: true,
            direction: 'top',
            offset: [0, -11],
            className: 'leaflet-tooltip-tactical',
          });
        }
        group.addLayer(marker);
      }

      if (feature.type === 'route' && feature.geometry.length >= 2) {
        const latlngs = feature.geometry.map(([lat, lng]) => [lat, lng] as [number, number]);
        const line = L.polyline(latlngs, { color, weight: baseWeight, opacity: 0.35, dashArray: dashArray ?? '8 6' });
        if (feature.label) {
          line.bindTooltip(feature.label, labelMode === 'always'
            ? { permanent: true, direction: 'center', className: 'leaflet-tooltip-tactical' }
            : { sticky: true, className: 'leaflet-tooltip-tactical' });
        }
        group.addLayer(line);
      }

      if (feature.type === 'area' && feature.geometry.length >= 3) {
        const areaBaseWeight = feature.style.weight ?? 1.5;
        const latlngs = feature.geometry.map(([lat, lng]) => [lat, lng] as [number, number]);
        const polygon = L.polygon(latlngs, { color, weight: areaBaseWeight, opacity: 0.35, fillColor: color, fillOpacity: 0.08, dashArray: dashArray ?? undefined });
        if (feature.label) {
          polygon.bindTooltip(feature.label, labelMode === 'always'
            ? { permanent: true, direction: 'center', className: 'leaflet-tooltip-tactical' }
            : { sticky: true, className: 'leaflet-tooltip-tactical' });
        }
        group.addLayer(polygon);
      }
    }
  }, [readOnlyFeatures, labelMode]);

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
      const midLat = (measurePoints[0][0] + measurePoints[1][0]) / 2;
      const midLng = (measurePoints[0][1] + measurePoints[1][1]) / 2;
      const bearLabel = formatBearing(measureResult.bearing, bearingReference, midLat, midLng);

      line.bindTooltip(`${distLabel} · ${bearLabel}`, {
        permanent: true,
        direction: 'center',
        className: 'leaflet-tooltip-measure',
      });

      group.addLayer(line);
    }
  }, [measurePoints, measureResult, bearingReference]);

  // Sync transient temp-point marker. Uncommitted — a pulsing dashed ring
  // around a hollow dot distinguishes it from real waypoints.
  useEffect(() => {
    const group = tempPointLayerRef.current;
    group.clearLayers();
    if (!tempPoint) return;
    const html = `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:0;border-radius:50%;border:2px dashed #2563EB;opacity:0.85;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#FFFFFF;border:2px solid #2563EB;box-shadow:0 1px 2px rgba(0,0,0,0.35);"></div>
      </div>`;
    const icon = L.divIcon({ html, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
    L.marker([tempPoint.lat, tempPoint.lng], { icon, interactive: false }).addTo(group);
  }, [tempPoint]);

  // Sync transient pin-to-pin navigation route. Dashed polyline + hollow
  // dots at each vertex to distinguish from committed route features.
  // Non-interactive in sub-step A; vertex drag + add land in sub-step B.
  useEffect(() => {
    const group = tempRouteLayerRef.current;
    group.clearLayers();
    if (!tempRoute || tempRoute.points.length === 0) return;
    const color = '#2563EB';
    if (tempRoute.closed && tempRoute.points.length >= 3) {
      L.polygon(tempRoute.points as L.LatLngTuple[], {
        color,
        weight: 3,
        opacity: 0.85,
        dashArray: '6 6',
        fillColor: color,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(group);
    } else if (tempRoute.points.length >= 2) {
      L.polyline(tempRoute.points as L.LatLngTuple[], {
        color,
        weight: 3,
        opacity: 0.85,
        dashArray: '6 6',
        interactive: false,
      }).addTo(group);
    }
    const dotHtml = `<div style="width:12px;height:12px;border-radius:50%;background:#FFFFFF;border:2px solid ${color};box-shadow:0 1px 2px rgba(0,0,0,0.35);"></div>`;
    const dotIcon = L.divIcon({ html: dotHtml, className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
    tempRoute.points.forEach(([lat, lng], idx) => {
      const m = L.marker([lat, lng], { icon: dotIcon, draggable: !!onTempRouteChange });
      if (onTempRouteChange) {
        m.on('dragend', () => {
          const p = m.getLatLng();
          const next = tempRoute.points.map(([la, ln], i) => (
            i === idx ? [p.lat, p.lng] as [number, number] : [la, ln] as [number, number]
          ));
          onTempRouteChange(next);
        });
      }
      m.addTo(group);
    });
  }, [tempRoute, onTempRouteChange]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, z?: number) => {
      mapRef.current?.flyTo([lat, lng], z ?? mapRef.current.getZoom(), { duration: 1.2 });
    },
    fitBounds: (bbox: [number, number, number, number]) => {
      const [west, south, east, north] = bbox;
      mapRef.current?.fitBounds([[south, west], [north, east]], { padding: [40, 40], maxZoom: 15 });
    },
    invalidateSize: () => {
      markProgrammaticMove();
      mapRef.current?.invalidateSize();
    },
    containerDistancePx: (latA, lngA, latB, lngB) => {
      const m = mapRef.current;
      if (!m) return Infinity;
      const a = m.latLngToContainerPoint([latA, lngA]);
      const b = m.latLngToContainerPoint([latB, lngB]);
      return Math.hypot(a.x - b.x, a.y - b.y);
    },
  }), []);

  const CTRL_BTN = 'w-9 h-9 rounded-lg flex items-center justify-center bg-themewhite2/90 dark:bg-themewhite3/90 text-primary shadow-sm active:scale-95 transition-all backdrop-blur-sm';

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ backgroundColor: theme === 'dark' ? 'rgb(15, 25, 35)' : 'rgb(240, 242, 245)' }}
      />

      {showGrid && (
        <MGRSGridLabels
          map={mapInstance}
          theme={getGridTheme(themeName, theme)}
          coordDisplay={coordDisplay}
          topOffset={controlsTopOffset}
        />
      )}

      <PreviewOverlay
        isOpen={showReadout}
        onClose={() => setShowReadout(false)}
        anchorRect={readoutAnchor}
        title="Coordinates"
        maxWidth={340}
        containerRef={wrapperRef}
        zIndex={1100}
      >
        <div className="flex flex-col gap-2 p-1">
          {([
            { label: 'MGRS', value: mgrsReadout && mgrsReadout !== '---' ? mgrsReadout : '', key: 'mgrs' as const },
            { label: 'UTM', value: utmText, key: 'utm' as const },
            { label: 'Lat / Lng', value: latLngText, key: 'latlng' as const },
            { label: 'Address', value: addressLoading ? '' : address, key: 'address' as const, loading: addressLoading },
          ]).map(row => (
            <div key={row.key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-themewhite2/60 dark:bg-themewhite3/60">
              <div className="flex-1 min-w-0">
                <div className="text-[9pt] font-medium text-tertiary uppercase tracking-wide">{row.label}</div>
                <div className="text-[10pt] font-mono text-primary truncate" title={row.value || undefined}>
                  {row.loading ? 'Loading…' : (row.value || '—')}
                </div>
              </div>
              <button
                type="button"
                disabled={!row.value}
                onClick={() => handleCopyField(row.value, row.key)}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all disabled:opacity-30"
                aria-label={`Copy ${row.label}`}
                title={`Copy ${row.label}`}
              >
                {copiedField === row.key
                  ? <ClipboardCheck size={16} className="text-themegreen" />
                  : <Copy size={16} />}
              </button>
            </div>
          ))}
        </div>
      </PreviewOverlay>

      {/* Bottom-left: zoom controls */}
      <div data-tour="map-zoom-controls" className="absolute bottom-4 left-3 z-[1000] flex flex-col gap-1.5 pointer-events-auto pb-[max(0rem,var(--sab,0px))]">
        <button type="button" onClick={handleZoomIn} className={CTRL_BTN} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={handleZoomOut} className={CTRL_BTN} aria-label="Zoom out">
          <Minus size={16} />
        </button>
      </div>

      {/* Bottom-center island: basemap | locate | coord readout */}
      <BottomIsland z="z-[1000]" tour="map-control-island" barClassName="max-w-[calc(100%-7rem)]" glass>
          <button
            type="button"
            onClick={() => setShowBasemapPicker(v => !v)}
            data-tour="map-basemap-button"
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              showBasemapPicker ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            aria-label="Basemap"
            title="Basemap"
          >
            {(() => {
              const Icon = BASEMAP_ICONS[basemapId] ?? MapIcon;
              return <Icon size={18} />;
            })()}
          </button>
          <button
            type="button"
            onClick={handleOpenReadout}
            data-tour="map-coord-readout"
            className="min-w-0 flex items-center gap-1.5 px-2 h-9 rounded-full text-primary text-[10pt] font-mono active:scale-95 transition-all select-none"
            aria-label="Show coordinate detail"
          >
            <span className="truncate">{activeCoordText}</span>
          </button>
          <button
            type="button"
            onClick={handleRecenterGps}
            disabled={!gpsPosition}
            data-tour="map-recenter-gps"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all disabled:opacity-30"
            aria-label="Center on my position"
          >
            <LocateFixed size={16} />
          </button>
      </BottomIsland>

      {/* Basemap picker — ActionPill row, floats above the island's basemap glyph
          (mirrors the waypoint pin glyph picker convention) */}
      {showBasemapPicker && (
        <div data-tour="map-basemap-picker" className="absolute bottom-[4.25rem] inset-x-0 flex items-center justify-center z-[1001] pointer-events-none pb-[max(0rem,var(--sab,0px))]">
          <ActionPill className="pointer-events-auto">
            {Object.values(TILE_SOURCES).map((src) => {
              const active = basemapId === src.id;
              const Icon = BASEMAP_ICONS[src.id] ?? MapIcon;
              return (
                <button
                  key={src.id}
                  onClick={() => {
                    setBasemapId(src.id);
                    setShowBasemapPicker(false);
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    active ? 'bg-themeblue3 text-white' : 'bg-themeblue2/8 text-primary'
                  }`}
                  title={src.name}
                  aria-label={src.name}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </ActionPill>
        </div>
      )}

      {/* Floor rail — Genshin-style depth selector on the right edge. Shown
          only once the overlay actually has depth (>1 floor); flat overlays
          stay clean. New floors are added via the tree / feature editor. */}
      {floors && floors.length > 1 && onActiveFloorChange && (
        <FloorSelector
          floors={floors}
          activeFloor={activeFloor}
          onSelect={onActiveFloorChange}
          onDeleteFloor={onDeleteFloor}
        />
      )}

      {/* Attribution — collapsed info icon top-right so the Add FAB at bottom-right doesn't overlap it */}
      <div className="absolute right-3 z-[1000] flex items-center gap-1.5 top-[calc(var(--drawer-header-h,0px)+0.75rem)]">
        {showAttribution && (
          <span className="text-[9pt] text-secondary bg-themewhite2/80 dark:bg-themewhite3/80
            backdrop-blur-sm px-2 py-0.5 rounded-md animate-fadeIn">
            © OpenStreetMap contributors
          </span>
        )}
        <button
          type="button"
          onClick={toggleAttribution}
          className={CTRL_BTN}
          aria-label="Map attribution"
        >
          <Info size={16} />
        </button>
      </div>
    </div>
  );
});

export default MapView;
