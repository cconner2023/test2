import { useState, useRef, useCallback } from 'react'
import { Copy, ClipboardCheck } from 'lucide-react'
import { forward, toPoint } from 'mgrs'
import { ErrorDisplay } from '../ErrorDisplay'

interface MGRSConverterProps {
  onCoordinateSelect?: (lat: number, lng: number, mgrs: string) => void
}

const DEBOUNCE_MS = 200

const MGRS_PATTERN = /^[0-9]{1,2}[C-X][A-Z]{2}\d{2,10}$/i

function parseMgrs(input: string): { lat: number; lng: number } | string {
  const cleaned = input.replace(/\s+/g, '')
  if (!cleaned) return 'Enter an MGRS coordinate'
  if (!MGRS_PATTERN.test(cleaned)) return 'Invalid MGRS format'
  try {
    const [lng, lat] = toPoint(cleaned)
    return { lat, lng }
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid MGRS coordinate'
  }
}

function parseLatLng(input: string): { lat: number; lng: number } | string {
  const trimmed = input.trim()
  if (!trimmed) return 'Enter lat, lng'
  const parts = trimmed.split(',')
  if (parts.length !== 2) return 'Expected format: lat, lng'
  const lat = parseFloat(parts[0].trim())
  const lng = parseFloat(parts[1].trim())
  if (isNaN(lat) || isNaN(lng)) return 'Both values must be numbers'
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90'
  if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180'
  if (lat < -80 || lat > 84) return 'MGRS does not cover latitudes below -80 or above 84'
  return { lat, lng }
}

function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

function toMgrsString(lat: number, lng: number): string {
  return forward([lng, lat], 5)
}

export function MGRSConverter({ onCoordinateSelect }: MGRSConverterProps) {
  const [mgrsInput, setMgrsInput] = useState('')
  const [latLngInput, setLatLngInput] = useState('')
  const [mgrsError, setMgrsError] = useState<string | null>(null)
  const [latLngError, setLatLngError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<'mgrs' | 'latlng' | null>(null)

  const mgrsTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const latLngTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const copyToClipboard = useCallback((text: string, field: 'mgrs' | 'latlng') => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    })
  }, [])

  const handleMgrsChange = useCallback((value: string) => {
    setMgrsInput(value)
    setMgrsError(null)
    clearTimeout(mgrsTimerRef.current)

    if (!value.trim()) {
      setLatLngInput('')
      setLatLngError(null)
      return
    }

    mgrsTimerRef.current = setTimeout(() => {
      const result = parseMgrs(value)
      if (typeof result === 'string') {
        setMgrsError(result)
        return
      }
      setLatLngInput(formatLatLng(result.lat, result.lng))
      setLatLngError(null)
      onCoordinateSelect?.(result.lat, result.lng, value.replace(/\s+/g, '').toUpperCase())
    }, DEBOUNCE_MS)
  }, [onCoordinateSelect])

  const handleLatLngChange = useCallback((value: string) => {
    setLatLngInput(value)
    setLatLngError(null)
    clearTimeout(latLngTimerRef.current)

    if (!value.trim()) {
      setMgrsInput('')
      setMgrsError(null)
      return
    }

    latLngTimerRef.current = setTimeout(() => {
      const result = parseLatLng(value)
      if (typeof result === 'string') {
        setLatLngError(result)
        return
      }
      try {
        const mgrs = toMgrsString(result.lat, result.lng)
        setMgrsInput(mgrs)
        setMgrsError(null)
        onCoordinateSelect?.(result.lat, result.lng, mgrs)
      } catch (e) {
        setLatLngError(e instanceof Error ? e.message : 'Conversion failed')
      }
    }, DEBOUNCE_MS)
  }, [onCoordinateSelect])

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-themewhite dark:bg-themewhite3 border border-tertiary/10">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">MGRS</span>
        <div className="relative">
          <input
            type="text"
            value={mgrsInput}
            onChange={(e) => handleMgrsChange(e.target.value)}
            placeholder="e.g., 18SUJ2337106519"
            className="w-full px-3 py-2.5 pr-10 rounded-lg text-primary text-base
                       border border-tertiary/10 bg-themewhite dark:bg-themewhite3
                       focus:border-themeblue2 focus:outline-none
                       transition-all placeholder:text-tertiary"
          />
          <button
            type="button"
            onClick={() => copyToClipboard(mgrsInput, 'mgrs')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded
                       text-tertiary hover:text-tertiary transition-colors active:scale-95"
            aria-label="Copy MGRS"
          >
            {copiedField === 'mgrs' ? <ClipboardCheck size={16} /> : <Copy size={16} />}
          </button>
        </div>
        {copiedField === 'mgrs' && (
          <span className="text-[10pt] text-themegreen font-medium">Copied!</span>
        )}
        <ErrorDisplay message={mgrsError} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Lat / Lng</span>
        <div className="relative">
          <input
            type="text"
            value={latLngInput}
            onChange={(e) => handleLatLngChange(e.target.value)}
            placeholder="e.g., 38.8977, -77.0365"
            className="w-full px-3 py-2.5 pr-10 rounded-lg text-primary text-base
                       border border-tertiary/10 bg-themewhite dark:bg-themewhite3
                       focus:border-themeblue2 focus:outline-none
                       transition-all placeholder:text-tertiary"
          />
          <button
            type="button"
            onClick={() => copyToClipboard(latLngInput, 'latlng')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded
                       text-tertiary hover:text-tertiary transition-colors active:scale-95"
            aria-label="Copy coordinates"
          >
            {copiedField === 'latlng' ? <ClipboardCheck size={16} /> : <Copy size={16} />}
          </button>
        </div>
        {copiedField === 'latlng' && (
          <span className="text-[10pt] text-themegreen font-medium">Copied!</span>
        )}
        <ErrorDisplay message={latLngError} />
      </div>
    </div>
  )
}
