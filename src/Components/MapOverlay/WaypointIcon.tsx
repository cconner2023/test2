import type { WaypointType } from '../../Types/MapOverlayTypes';

interface WaypointIconProps {
  type: WaypointType;
  color: string;
  size?: number;
  selected?: boolean;
}

const KNOWN_TYPES: WaypointType[] = [
  'circle', 'cross', 'triangle',
  'friendly', 'enemy', 'neutral',
  'lz', 'pz', 'dz',
  'ccp', 'axp', 'obj', 'rally',
  'hazard', 'target', 'supply', 'vehicle', 'medic', 'comms',
  'casualty',
];

function normalize(type: string | undefined): WaypointType {
  return (KNOWN_TYPES as string[]).includes(type ?? '') ? (type as WaypointType) : 'circle';
}

function glyphMarkup(type: WaypointType, size: number, color: string): string {
  const c = size / 2;
  const fill = `style="fill: ${color}"`;
  const stroke = `style="stroke: ${color}"`;
  const strokeFill = `style="stroke: ${color}; fill: none"`;
  const txt = `style="fill: ${color}; font: 700 ${Math.round(size * 0.36)}px ui-monospace,monospace; user-select: none"`;

  switch (type) {
    case 'circle':
      return `<circle cx="${c}" cy="${c}" r="${size * 0.32}" ${fill}/>`;
    case 'cross': {
      const armW = size * 0.22, armL = size * 0.78, r = armW * 0.25;
      return (
        `<rect x="${(size - armL) / 2}" y="${(size - armW) / 2}" width="${armL}" height="${armW}" rx="${r}" ${fill}/>` +
        `<rect x="${(size - armW) / 2}" y="${(size - armL) / 2}" width="${armW}" height="${armL}" rx="${r}" ${fill}/>`
      );
    }
    case 'triangle': {
      const half = size * 0.36, top = size * 0.16, bot = size * 0.82;
      return `<path d="M ${c} ${top} L ${c + half} ${bot} L ${c - half} ${bot} Z" ${fill}/>`;
    }
    case 'friendly': {
      // Blue rectangle, MIL-STD-2525-style friendly frame.
      const w = size * 0.66, h = size * 0.50;
      return `<rect x="${(size - w) / 2}" y="${(size - h) / 2}" width="${w}" height="${h}" rx="2" ${fill}/>`;
    }
    case 'enemy': {
      // Red diamond.
      const r = size * 0.36;
      return `<path d="M ${c} ${c - r} L ${c + r} ${c} L ${c} ${c + r} L ${c - r} ${c} Z" ${fill}/>`;
    }
    case 'neutral': {
      // Green square (rotated 0°).
      const s = size * 0.50;
      return `<rect x="${(size - s) / 2}" y="${(size - s) / 2}" width="${s}" height="${s}" ${fill}/>`;
    }
    case 'lz':
      // Bold "H" inside a roundel — helicopter LZ.
      return (
        `<circle cx="${c}" cy="${c}" r="${size * 0.42}" ${strokeFill} stroke-width="2"/>` +
        `<text x="${c}" y="${c + size * 0.13}" text-anchor="middle" ${txt}>H</text>`
      );
    case 'pz':
      return (
        `<circle cx="${c}" cy="${c}" r="${size * 0.42}" ${strokeFill} stroke-width="2"/>` +
        `<text x="${c}" y="${c + size * 0.13}" text-anchor="middle" ${txt}>P</text>`
      );
    case 'dz':
      return (
        `<circle cx="${c}" cy="${c}" r="${size * 0.42}" ${strokeFill} stroke-width="2" stroke-dasharray="3 2"/>` +
        `<text x="${c}" y="${c + size * 0.13}" text-anchor="middle" ${txt}>D</text>`
      );
    case 'ccp':
      // Casualty Collection Point — white-on-color cross inside a square.
      return (
        `<rect x="${size * 0.18}" y="${size * 0.18}" width="${size * 0.64}" height="${size * 0.64}" rx="2" ${fill}/>` +
        `<rect x="${size * 0.30}" y="${size * 0.46}" width="${size * 0.40}" height="${size * 0.08}" fill="#fff"/>` +
        `<rect x="${size * 0.46}" y="${size * 0.30}" width="${size * 0.08}" height="${size * 0.40}" fill="#fff"/>`
      );
    case 'axp':
      // Ambulance Exchange Point — square with "X".
      return (
        `<rect x="${size * 0.18}" y="${size * 0.18}" width="${size * 0.64}" height="${size * 0.64}" rx="2" ${strokeFill} stroke-width="2"/>` +
        `<text x="${c}" y="${c + size * 0.13}" text-anchor="middle" ${txt}>X</text>`
      );
    case 'obj':
      // Objective — outlined circle with "OBJ".
      return (
        `<circle cx="${c}" cy="${c}" r="${size * 0.42}" ${strokeFill} stroke-width="2.5"/>`
      );
    case 'rally':
      // Rally point — concentric rings.
      return (
        `<circle cx="${c}" cy="${c}" r="${size * 0.42}" ${strokeFill} stroke-width="1.5"/>` +
        `<circle cx="${c}" cy="${c}" r="${size * 0.22}" ${fill}/>`
      );
    case 'hazard': {
      // Yellow triangle with "!" (color overrides via prop, glyph is exclamation).
      const half = size * 0.40, top = size * 0.12, bot = size * 0.86;
      return (
        `<path d="M ${c} ${top} L ${c + half} ${bot} L ${c - half} ${bot} Z" ${fill}/>` +
        `<rect x="${c - size * 0.04}" y="${size * 0.36}" width="${size * 0.08}" height="${size * 0.30}" fill="#fff"/>` +
        `<rect x="${c - size * 0.04}" y="${size * 0.70}" width="${size * 0.08}" height="${size * 0.08}" fill="#fff"/>`
      );
    }
    case 'target':
      // Crosshair.
      return (
        `<circle cx="${c}" cy="${c}" r="${size * 0.40}" ${strokeFill} stroke-width="2"/>` +
        `<line x1="${c}" y1="${size * 0.10}" x2="${c}" y2="${size * 0.30}" ${stroke} stroke-width="2"/>` +
        `<line x1="${c}" y1="${size * 0.70}" x2="${c}" y2="${size * 0.90}" ${stroke} stroke-width="2"/>` +
        `<line x1="${size * 0.10}" y1="${c}" x2="${size * 0.30}" y2="${c}" ${stroke} stroke-width="2"/>` +
        `<line x1="${size * 0.70}" y1="${c}" x2="${size * 0.90}" y2="${c}" ${stroke} stroke-width="2"/>` +
        `<circle cx="${c}" cy="${c}" r="${size * 0.06}" ${fill}/>`
      );
    case 'supply':
      // Stack of three rectangles — supply cache.
      return (
        `<rect x="${size * 0.20}" y="${size * 0.62}" width="${size * 0.60}" height="${size * 0.18}" rx="1" ${fill}/>` +
        `<rect x="${size * 0.24}" y="${size * 0.42}" width="${size * 0.52}" height="${size * 0.18}" rx="1" ${fill} fill-opacity="0.75"/>` +
        `<rect x="${size * 0.28}" y="${size * 0.22}" width="${size * 0.44}" height="${size * 0.18}" rx="1" ${fill} fill-opacity="0.50"/>`
      );
    case 'vehicle':
      // Simplified vehicle silhouette.
      return (
        `<rect x="${size * 0.16}" y="${size * 0.42}" width="${size * 0.68}" height="${size * 0.26}" rx="3" ${fill}/>` +
        `<rect x="${size * 0.28}" y="${size * 0.30}" width="${size * 0.44}" height="${size * 0.18}" rx="2" ${fill}/>` +
        `<circle cx="${size * 0.30}" cy="${size * 0.74}" r="${size * 0.08}" fill="#fff" ${stroke} stroke-width="1.5"/>` +
        `<circle cx="${size * 0.70}" cy="${size * 0.74}" r="${size * 0.08}" fill="#fff" ${stroke} stroke-width="1.5"/>`
      );
    case 'medic':
      // Red cross on white — combat medic.
      return (
        `<rect x="${size * 0.16}" y="${size * 0.16}" width="${size * 0.68}" height="${size * 0.68}" rx="3" fill="#fff" ${stroke} stroke-width="1.5"/>` +
        `<rect x="${size * 0.28}" y="${size * 0.46}" width="${size * 0.44}" height="${size * 0.08}" ${fill}/>` +
        `<rect x="${size * 0.46}" y="${size * 0.28}" width="${size * 0.08}" height="${size * 0.44}" ${fill}/>`
      );
    case 'comms':
      // Antenna with broadcast arcs.
      return (
        `<line x1="${c}" y1="${size * 0.30}" x2="${c}" y2="${size * 0.84}" ${stroke} stroke-width="2.5"/>` +
        `<circle cx="${c}" cy="${size * 0.26}" r="${size * 0.05}" ${fill}/>` +
        `<path d="M ${c - size * 0.18} ${size * 0.36} A ${size * 0.18} ${size * 0.18} 0 0 1 ${c + size * 0.18} ${size * 0.36}" ${strokeFill} stroke-width="2"/>` +
        `<path d="M ${c - size * 0.30} ${size * 0.30} A ${size * 0.30} ${size * 0.30} 0 0 1 ${c + size * 0.30} ${size * 0.30}" ${strokeFill} stroke-width="2"/>`
      );
    case 'casualty':
      // White card with red cross + diagonal corner stripe — distinct from
      // 'medic' (which represents a medic person/asset). The corner stripe
      // signals "linked to a TC3 card" without exposing patient detail.
      return (
        `<rect x="${size * 0.16}" y="${size * 0.16}" width="${size * 0.68}" height="${size * 0.68}" rx="3" fill="#ffffff" ${stroke} stroke-width="1.75"/>` +
        `<rect x="${size * 0.30}" y="${size * 0.46}" width="${size * 0.40}" height="${size * 0.08}" ${fill}/>` +
        `<rect x="${size * 0.46}" y="${size * 0.30}" width="${size * 0.08}" height="${size * 0.40}" ${fill}/>` +
        `<path d="M ${size * 0.62} ${size * 0.16} L ${size * 0.84} ${size * 0.16} L ${size * 0.84} ${size * 0.38} Z" ${fill}/>`
      );
  }
}

function selectionRingMarkup(size: number, color: string): string {
  const c = size / 2;
  return `<circle cx="${c}" cy="${c}" r="${size * 0.46}" fill="none" style="stroke: ${color}" stroke-width="1.5" opacity="0.4"/>`;
}

export function WaypointIcon({ type, color, size = 28, selected = false }: WaypointIconProps) {
  const normalized = normalize(type);
  const html = (selected ? selectionRingMarkup(size, color) : '') + glyphMarkup(normalized, size, color);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * SVG string for Leaflet's L.divIcon. Transparent background — only the glyph
 * is painted, in the feature's color. Unknown legacy waypoint_type values
 * from existing overlays fall back to 'circle'.
 *
 * `linkedCasualty` flag (Phase 4.1): when true, the casualty glyph is drawn
 * regardless of `type`. The link supersedes the chosen glyph because the
 * link state is the more important visual signal at a glance.
 */
export function waypointIconSvg(
  type: string | undefined,
  color: string,
  size = 28,
  selected = false,
  linkedCasualty = false,
): string {
  const normalized = linkedCasualty ? 'casualty' as WaypointType : normalize(type);
  const ring = selected ? selectionRingMarkup(size, color) : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${ring}${glyphMarkup(normalized, size, color)}</svg>`;
}
