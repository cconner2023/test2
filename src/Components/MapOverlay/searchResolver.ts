import { toPoint } from 'mgrs';
import { utmToLatLng } from './utmProjection';

export interface SearchResult {
  lat: number;
  lng: number;
  label: string;
  zoom?: number;
  /** Nominatim relevance score (0–1). Absent for exact-input matches
   *  (MGRS / UTM / lat-lng), which are always treated as high confidence. */
  importance?: number;
}

const MGRS_RE = /^\d{1,2}[A-Z]\s*[A-Z]{2}\s*\d{2,10}$/i;
const LATLNG_RE = /^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/;
// UTM: "<zone><N|S> <easting> <northing>" — zone 1-60, hemisphere letter, two numeric groups.
// Rejects MGRS (which has a 2-letter 100km square after the zone band).
const UTM_RE = /^(\d{1,2})\s*([NS])\s+(\d{4,7}(?:\.\d+)?)\s+(\d{4,7}(?:\.\d+)?)$/i;

function tryMgrs(query: string): SearchResult | null {
  const cleaned = query.trim().toUpperCase();
  if (!MGRS_RE.test(cleaned)) return null;
  try {
    const [lng, lat] = toPoint(cleaned);
    return { lat, lng, label: cleaned, zoom: 15 };
  } catch {
    return null;
  }
}

function tryUtm(query: string): SearchResult | null {
  const m = query.trim().match(UTM_RE);
  if (!m) return null;
  const zone = parseInt(m[1], 10);
  if (zone < 1 || zone > 60) return null;
  const northern = m[2].toUpperCase() === 'N';
  const easting = parseFloat(m[3]);
  const northing = parseFloat(m[4]);
  try {
    const [lat, lng] = utmToLatLng(easting, northing, zone, northern);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng, label: `${zone}${northern ? 'N' : 'S'} ${Math.round(easting)} ${Math.round(northing)}`, zoom: 15 };
  } catch {
    return null;
  }
}

function tryLatLng(query: string): SearchResult | null {
  const match = query.trim().match(LATLNG_RE);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, zoom: 15 };
}

async function tryNominatim(query: string): Promise<SearchResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const { lat, lon, display_name, importance } = data[0];
    const short = display_name.split(',').slice(0, 2).join(',').trim();
    const imp = typeof importance === 'number' ? importance : parseFloat(importance);
    return {
      lat: parseFloat(lat),
      lng: parseFloat(lon),
      label: short,
      zoom: 14,
      importance: Number.isFinite(imp) ? imp : undefined,
    };
  } catch {
    return null;
  }
}

export async function resolveSearch(query: string): Promise<SearchResult | null> {
  const q = query.trim();
  if (!q) return null;
  return tryMgrs(q) ?? tryUtm(q) ?? tryLatLng(q) ?? await tryNominatim(q);
}
