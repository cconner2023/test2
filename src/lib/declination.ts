import geomagnetism from 'geomagnetism'

export type BearingReference = 'true' | 'grid' | 'magnetic'

/**
 * Magnetic declination at a point in degrees, east positive.
 * Uses the embedded WMM coefficients from the `geomagnetism` package.
 */
export function magneticDeclination(lat: number, lng: number, date: Date = new Date()): number {
  const m = geomagnetism.model(date, { allowOutOfBoundsModel: true })
  return m.point([lat, lng]).decl
}

/**
 * UTM grid convergence (γ) at a point in degrees, east positive.
 * Convergence is the angle between true north and grid north. Positive east of
 * the zone's central meridian, negative west of it. Uses the standard first-
 * order approximation γ ≈ Δλ · sin(φ) — accurate to better than 0.01° within
 * a UTM zone, which is well below tactical relevance at AO scales.
 */
export function gridConvergence(lat: number, lng: number): number {
  const zone = Math.floor((lng + 180) / 6) + 1
  const centralMeridian = -177 + (zone - 1) * 6
  const dLng = lng - centralMeridian
  const phi = (lat * Math.PI) / 180
  const conv = dLng * Math.sin(phi)
  return conv
}

/**
 * Convert a true bearing to the chosen reference at a given location.
 * Returns degrees in [0, 360).
 *
 * Conventions:
 *   magnetic = true − declination_east
 *   grid     = true − convergence_east
 */
export function applyBearingReference(
  trueBearing: number,
  ref: BearingReference,
  lat: number,
  lng: number,
  date: Date = new Date(),
): number {
  let out = trueBearing
  if (ref === 'magnetic') out = trueBearing - magneticDeclination(lat, lng, date)
  else if (ref === 'grid') out = trueBearing - gridConvergence(lat, lng)
  return ((out % 360) + 360) % 360
}

/** Short suffix for UI labels: "045°T" / "045°G" / "045°M". */
export function bearingSuffix(ref: BearingReference): 'T' | 'G' | 'M' {
  if (ref === 'magnetic') return 'M'
  if (ref === 'grid') return 'G'
  return 'T'
}

/** Format a bearing for display: "045°T". */
export function formatBearing(trueBearing: number, ref: BearingReference, lat: number, lng: number, date?: Date): string {
  const v = applyBearingReference(trueBearing, ref, lat, lng, date)
  return `${Math.round(v).toString().padStart(3, '0')}°${bearingSuffix(ref)}`
}
