import { useState, useCallback, useRef } from 'react'
import { estimateWBGT, getCategory } from '../lib/wbgtUtils'
import type { HeatCategory } from '../lib/wbgtUtils'

const CACHE_TTL_MS = 15 * 60 * 1000

interface WeatherCache {
  temp: number
  rh: number
  wbgt: number
  category: HeatCategory | null
  fetchedAt: number
}

// Module-level cache — survives remounts within a session
let moduleCache: WeatherCache | null = null

function isCacheFresh(): boolean {
  return moduleCache !== null && Date.now() - moduleCache.fetchedAt < CACHE_TTL_MS
}

export interface WeatherState {
  temp: number | null
  rh: number | null
  wbgt: number | null
  category: HeatCategory | null
  loading: boolean
  error: string | null
  locationError: string | null
  lastUpdated: Date | null
  refresh: () => void
}

export function useWeather(): WeatherState {
  const [state, setState] = useState<Omit<WeatherState, 'refresh'>>(() => {
    if (isCacheFresh()) {
      const c = moduleCache!
      return { temp: c.temp, rh: c.rh, wbgt: c.wbgt, category: c.category, loading: false, error: null, locationError: null, lastUpdated: new Date(c.fetchedAt) }
    }
    return { temp: null, rh: null, wbgt: null, category: null, loading: false, error: null, locationError: null, lastUpdated: null }
  })

  const fetchingRef = useRef(false)

  const fetchWeather = useCallback((lat: number, lng: number) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setState(s => ({ ...s, loading: true, error: null }))

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit`

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ current: { temperature_2m: number; relative_humidity_2m: number } }>
      })
      .then(data => {
        const temp = data.current.temperature_2m
        const rh = data.current.relative_humidity_2m
        const wbgt = estimateWBGT(temp, rh)
        const category = getCategory(wbgt)
        const fetchedAt = Date.now()
        moduleCache = { temp, rh, wbgt, category, fetchedAt }
        setState({ temp, rh, wbgt, category, loading: false, error: null, locationError: null, lastUpdated: new Date(fetchedAt) })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Fetch failed'
        setState(s => ({ ...s, loading: false, error: msg }))
      })
      .finally(() => { fetchingRef.current = false })
  }, [])

  const requestLocation = useCallback((forceRefresh = false) => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, locationError: 'Geolocation not supported' }))
      return
    }
    if (!forceRefresh && isCacheFresh()) {
      const c = moduleCache!
      setState({ temp: c.temp, rh: c.rh, wbgt: c.wbgt, category: c.category, loading: false, error: null, locationError: null, lastUpdated: new Date(c.fetchedAt) })
      return
    }
    setState(s => ({ ...s, loading: true, locationError: null, error: null }))
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      err => {
        const msg = err.code === 1 ? 'Location denied' : err.code === 2 ? 'Location unavailable' : 'Location timeout'
        setState(s => ({ ...s, loading: false, locationError: msg }))
      },
      { timeout: 10000, maximumAge: forceRefresh ? 0 : 5 * 60 * 1000 },
    )
  }, [fetchWeather])

  const refresh = useCallback(() => requestLocation(true), [requestLocation])

  return { ...state, refresh }
}
