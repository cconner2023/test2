/** Minimal WGS-84 UTM projection — forward and inverse Transverse Mercator. */

const A = 6378137
const F = 1 / 298.257223563
const E2 = 2 * F - F * F
const E4 = E2 * E2
const E6 = E4 * E2
const K0 = 0.9996
const E_PRIME2 = E2 / (1 - E2)

const M_COEFFS = [
  1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256,
  3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024,
  15 * E4 / 256 + 45 * E6 / 1024,
  35 * E6 / 3072,
] as const

function meridianArc(lat: number): number {
  return A * (
    M_COEFFS[0] * lat -
    M_COEFFS[1] * Math.sin(2 * lat) +
    M_COEFFS[2] * Math.sin(4 * lat) -
    M_COEFFS[3] * Math.sin(6 * lat)
  )
}

export function utmZone(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1
}

export function centralMeridian(zone: number): number {
  return (zone - 1) * 6 - 180 + 3
}

export interface UTMCoord { easting: number; northing: number; zone: number; northern: boolean }

export function latLngToUTM(lat: number, lng: number, zone?: number): UTMCoord {
  const z = zone ?? utmZone(lng)
  const cm = centralMeridian(z)
  const latR = (lat * Math.PI) / 180
  const dlng = ((lng - cm) * Math.PI) / 180

  const sinLat = Math.sin(latR)
  const cosLat = Math.cos(latR)
  const tanLat = Math.tan(latR)
  const T = tanLat * tanLat
  const C = E_PRIME2 * cosLat * cosLat
  const AA = cosLat * dlng
  const N = A / Math.sqrt(1 - E2 * sinLat * sinLat)
  const M = meridianArc(latR)

  const easting =
    K0 * N * (AA + (1 - T + C) * AA ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * E_PRIME2) * AA ** 5 / 120) + 500000

  let northing =
    K0 * (M + N * tanLat * (AA * AA / 2 + (5 - T + 9 * C + 4 * C * C) * AA ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * E_PRIME2) * AA ** 6 / 720))

  const northern = lat >= 0
  if (!northern) northing += 10000000

  return { easting, northing, zone: z, northern }
}

export function utmToLatLng(easting: number, northing: number, zone: number, northern: boolean): [number, number] {
  const cm = centralMeridian(zone)
  let n = northing
  if (!northern) n -= 10000000

  const M = n / K0
  const mu = M / (A * M_COEFFS[0])

  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const phi1 =
    mu +
    (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    (151 * e1 ** 3 / 96) * Math.sin(6 * mu) +
    (1097 * e1 ** 4 / 512) * Math.sin(8 * mu)

  const sinPhi = Math.sin(phi1)
  const cosPhi = Math.cos(phi1)
  const tanPhi = Math.tan(phi1)
  const N1 = A / Math.sqrt(1 - E2 * sinPhi * sinPhi)
  const T1 = tanPhi * tanPhi
  const C1 = E_PRIME2 * cosPhi * cosPhi
  const R1 = (A * (1 - E2)) / (1 - E2 * sinPhi * sinPhi) ** 1.5
  const D = (easting - 500000) / (N1 * K0)

  const lat =
    phi1 -
    (N1 * tanPhi / R1) *
      (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * E_PRIME2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * E_PRIME2 - 3 * C1 * C1) * D ** 6 / 720)

  const lng =
    (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * E_PRIME2 + 24 * T1 * T1) * D ** 5 / 120) / cosPhi

  return [(lat * 180) / Math.PI, cm + (lng * 180) / Math.PI]
}
