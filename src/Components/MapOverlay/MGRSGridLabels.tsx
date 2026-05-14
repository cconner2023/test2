import { useEffect, useState } from 'react';
import L from 'leaflet';
import { latLngToUTM, utmToLatLng, utmZone } from './utmProjection';
import { gridIntervalMeters, formatGridLabel, type GridTheme } from './MGRSGridLayer';

interface MGRSGridLabelsProps {
  map: L.Map | null;
  theme: GridTheme;
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
export function MGRSGridLabels({ map, theme, topOffset = 0 }: MGRSGridLabelsProps) {
  const [eastings, setEastings] = useState<EdgeLabel[]>([]);
  const [northings, setNorthings] = useState<EdgeLabel[]>([]);

  useEffect(() => {
    if (!map) return;

    const recompute = () => {
      const size = map.getSize();
      const bounds = map.getBounds();
      const center = bounds.getCenter();
      const zone = utmZone(center.lng);
      const northern = center.lat >= 0;
      const interval = gridIntervalMeters(map.getZoom());

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

      // Find where each easting line crosses the top edge — sample northings
      // top-down and pick the first sample whose projected y is within the
      // top band. UTM lines are nearly vertical on screen at typical zooms.
      const newEastings: EdgeLabel[] = [];
      for (let e = startE; e <= maxE + interval; e += interval) {
        const [lat, lng] = utmToLatLng(e, maxN, zone, northern);
        const pt = map.latLngToContainerPoint([lat, lng]);
        if (pt.x >= 8 && pt.x <= size.x - 8) {
          newEastings.push({ pos: pt.x, text: formatGridLabel(e, interval) });
        }
      }

      const newNorthings: EdgeLabel[] = [];
      for (let n = startN; n <= maxN + interval; n += interval) {
        const [lat, lng] = utmToLatLng(maxE, n, zone, northern);
        const pt = map.latLngToContainerPoint([lat, lng]);
        if (pt.y >= 8 && pt.y <= size.y - 8) {
          newNorthings.push({ pos: pt.y, text: formatGridLabel(n, interval) });
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
  }, [map]);

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
    </div>
  );
}
