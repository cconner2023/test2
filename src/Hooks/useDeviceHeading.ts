import { useEffect, useState, useCallback } from 'react'

/**
 * Compass heading from DeviceOrientationEvent. Returns degrees [0, 360) where
 * 0 = north, or null when unavailable / permission not yet granted.
 *
 * iOS Safari requires a user-gesture-triggered call to
 * DeviceOrientationEvent.requestPermission() before any events fire — call
 * `requestPermission()` from a tap handler. Other platforms grant implicitly.
 */
export interface UseDeviceHeadingReturn {
  heading: number | null
  permission: 'unknown' | 'granted' | 'denied' | 'unavailable'
  requestPermission: () => Promise<void>
}

type IosOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number
}

type RequestableCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function useDeviceHeading(): UseDeviceHeadingReturn {
  const [heading, setHeading] = useState<number | null>(null)
  const [permission, setPermission] = useState<UseDeviceHeadingReturn['permission']>(
    typeof DeviceOrientationEvent === 'undefined' ? 'unavailable' : 'unknown',
  )

  const handle = useCallback((e: DeviceOrientationEvent) => {
    const ev = e as IosOrientationEvent
    if (typeof ev.webkitCompassHeading === 'number') {
      setHeading(ev.webkitCompassHeading)
      return
    }
    if (typeof e.alpha === 'number') {
      const h = (360 - e.alpha) % 360
      setHeading(h < 0 ? h + 360 : h)
    }
  }, [])

  useEffect(() => {
    if (permission !== 'granted') return
    window.addEventListener('deviceorientation', handle, true)
    return () => window.removeEventListener('deviceorientation', handle, true)
  }, [permission, handle])

  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermission('unavailable')
      return
    }
    const ctor = DeviceOrientationEvent as RequestableCtor
    if (typeof ctor.requestPermission === 'function') {
      try {
        const result = await ctor.requestPermission()
        setPermission(result === 'granted' ? 'granted' : 'denied')
      } catch {
        setPermission('denied')
      }
    } else {
      setPermission('granted')
    }
  }, [])

  return { heading, permission, requestPermission }
}
