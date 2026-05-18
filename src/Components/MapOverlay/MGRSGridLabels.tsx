import { useEffect, useState } from 'react';
import L from 'leaflet';
import { latLngToUTM, utmToLatLng, utmZone } from './utmProjection';
import {
  gridIntervalMeters,
  formatGridLabel,
  llGridInterval,
  formatLLLabel,
  type GridTheme,
} from './MGRSGridLayer';
import { mgrsSquareLabel } from '../../lib/mgrsFormat';
import type { CoordDisplay } from '../../stores/useMapPrefsStore';

interface MGRSGridLabelsProps {
  map: L.Map | null;
  theme: GridTheme;
  /** Drives label format: MGRS (truncated 100km square), UTM (absolute km), or LL (decimal degrees). */
  coordDisplay: CoordDisplay;
  /** Top-edge offset in px to clear floating controls (MGRS pill at top-left). */
  topOffset?: number;
}

interface EdgeLabel {
  pos: number;
  text: string;
}

/**
 * Renders MGRS easting labels along the top edge and northing labels along the
 * right edge of the map container. Recomputes on map move/zoom by sampling the
 * current viewport's UTM extent and projecting each major grid line back to
 * screen coordinates to find its top-edge / right-edge intersection.
 */
export function MGRSGridLabels({ map, theme, coordDisplay, topOffset = 0 }: MGRSGridLabelsProps) {
  const [eastings, setEastings] = useState<EdgeLabel[]>([]);
  const [northings, setNorthings] = useState<EdgeLabel[]>([]);
  const [cornerLabel, setCornerLabel] = useState('');

  useEffect(() => {
    if (!map) return;

    const recompute = () => {
      const size = map.getSize();
      const bounds = map.getBounds();
      const center = bounds.getCenter();
      const zoom = map.getZoom();

      const newEastings: EdgeLabel[] = [];
      const newNorthings: EdgeLabel[] = [];

      if (coordDisplay === 'latlng') {
        const interval = llGridInterval(zoom);
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLng = bounds.getWest();
        const maxLng = bounds.getEast();
        const startLat = Math.floor(minLat / interval) * interval;
        const startLng = Math.floor(minLng / interval) * interval;

        for (let lng = startLng; lng <= maxLng + interval; lng += interval) {
          const pt = map.latLngToContainerPoint([maxLat, lng]);
          if (pt.x >= 8 && pt.x <= size.x - 8) {
            newEastings.push({ pos: pt.x, text: formatLLLabel(lng, interval) });
          }
        }
        for (let lat = startLat; lat <= maxLat + interval; lat += interval) {
          const pt = map.latLngToContainerPoint([lat, maxLng]);
          if (pt.y >= 8 && pt.y <= size.y - 8) {
            newNorthings.push({ pos: pt.y, text: formatLLLabel(lat, interval) });
          }
        }
        setCornerLabel(center.lat >= 0 ? 'N/E' : 'S/E');
      } else {
        const zone = utmZone(center.lng);
        const northern = center.lat >= 0;
        const interval = gridIntervalMeters(zoom);

        const corners = [
          bounds.getNorthWest(),
          bounds.getNorthEast(),
          bounds.getSouthEast(),
          bounds.getSouthWest(),
        ].map(c => latLngToUTM(c.lat, c.lng, zone));

        const minE = Math.min(...corners.map(c => c.easting));
        const maxE = Math.max(...corners.map(c => c.easting));
        const minN = Math.min(...corners.map(c => c.northing));
        const maxN = Math.max(...corners.map(c => c.northing));

        const startE = Math.floor(minE / interval) * interval;
        const startN = Math.floor(minN / interval) * interval;

        // MGRS and UTM share the same edge-label format (2-digit principal
        // grid square + subdivision); only the corner anchor differs.
        for (let e = startE; e <= maxE + interval; e += interval) {
          const [lat, lng] = utmToLatLng(e, maxN, zone, northern);
          const pt = map.latLngToContainerPoint([lat, lng]);
          if (pt.x >= 8 && pt.x <= size.x - 8) {
            newEastings.push({ pos: pt.x, text: formatGridLabel(e, interval) });
          }
        }
        for (let n = startN; n <= maxN + interval; n += interval) {
          const [lat, lng] = utmToLatLng(maxE, n, zone, northern);
          const pt = map.latLngToContainerPoint([lat, lng]);
          if (pt.y >= 8 && pt.y <= size.y - 8) {
            newNorthings.push({ pos: pt.y, text: formatGridLabel(n, interval) });
          }
        }

        if (coordDisplay === 'utm') {
          setCornerLabel(`${zone}${northern ? 'N' : 'S'}`);
        } else {
          setCornerLabel(mgrsSquareLabel(center.lat, center.lng));
        }
      }

      setEastings(newEastings);
      setNorthings(newNorthings);
    };

    recompute();
    map.on('move', recompute);
    map.on('zoom', recompute);
    map.on('resize', recompute);
    return () => {
      map.off('move', recompute);
      map.off('zoom', recompute);
      map.off('resize', recompute);
    };
  }, [map, coordDisplay]);

  const labelStyle: React.CSSProperties = {
    background: theme.labelBg,
    color: theme.labelColor,
    font: '700 13px/1 ui-monospace, monospace',
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[800]">
      {/* Top edge — eastings */}
      <div className="absolute left-0 right-0" style={{ top: topOffset }}>
        {eastings.map((lbl, i) => (
          <span
            key={`e-${i}-${lbl.text}`}
            className="absolute px-1 py-px rounded-sm whitespace-nowrap"
            style={{
              ...labelStyle,
              left: lbl.pos,
              transform: 'translateX(-50%)',
            }}
          >
            {lbl.text}
          </span>
        ))}
      </div>
      {/* Right edge — northings */}
      <div className="absolute top-0 bottom-0 right-0">
        {northings.map((lbl, i) => (
          <span
            key={`n-${i}-${lbl.text}`}
            className="absolute px-1 py-px rounded-sm whitespace-nowrap"
            style={{
              ...labelStyle,
              top: lbl.pos,
              right: 2,
              transform: 'translateY(-50%)',
            }}
          >
            {lbl.text}
          </span>
        ))}
      </div>
      {/* Top-right corner anchor — MGRS: GZD + 100km square (e.g. "18S UJ");
          UTM: zone designator (e.g. "18N"); LL: hemisphere hint. Lets a medic
          reconstruct any edge-label pair into a full coordinate. */}
      {cornerLabel && (
        <span
          className="absolute px-1.5 py-0.5 rounded-sm whitespace-nowrap"
          style={{ ...labelStyle, top: topOffset, right: 2 }}
        >
          {cornerLabel}
        </span>
      )}
    </div>
  );
}
