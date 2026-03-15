import { toPoint } from 'mgrs';

export interface SearchResult {
  lat: number;
  lng: number;
  label: string;
  zoom?: number;
}

const MGRS_RE = /^\d{1,2}[A-Z]\s*[A-Z]{2}\s*\d{2,10}$/i;
const LATLNG_RE = /^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/;

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
    const { lat, lon, display_name } = data[0];
    const short = display_name.split(',').slice(0, 2).join(',').trim();
    return { lat: parseFloat(lat), lng: parseFloat(lon), label: short, zoom: 14 };
  } catch {
    return null;
  }
}

export async function resolveSearch(query: string): Promise<SearchResult | null> {
  const q = query.trim();
  if (!q) return null;
  return tryMgrs(q) ?? tryLatLng(q) ?? await tryNominatim(q);
}
