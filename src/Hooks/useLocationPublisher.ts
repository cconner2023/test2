import { useEffect, useRef, useCallback } from 'react'
import { forward } from 'mgrs'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarVault } from './useCalendarVault'
import { distanceMeters } from '../lib/geoUtils'

/** Minimum movement before a new position is published. */
const MOVEMENT_THRESHOLD_M = 100

/** Maximum interval between publishes even if no movement threshold is crossed. */
const HEARTBEAT_MS = 10 * 60 * 1000

interface PublisherPosition {
  lat: number
  lng: number
}

/**
 * Watches a GPS position and intermittently publishes it to a calendar event's
 * field_positions map via the existing Signal edit fan-out.
 *
 * Publishes when:
 *  - First fix arrives (no prior publish)
 *  - User has moved >= MOVEMENT_THRESHOLD_M since last publish
 *  - HEARTBEAT_MS has elapsed since last publish
 *
 * The event edit follows the same delete-old / send-new pattern as all other
 * calendar edits — no new Signal infrastructure required.
 *
 * @param eventId  Calendar event to publish into. Pass null to disable.
 * @param userId   User ID — key into field_positions map.
 * @param position Current GPS position from useGeolocation. Pass null when unavailable.
 * @param enabled  Master switch — set false to pause publishing without unmounting.
 */
export function useLocationPublisher(
  eventId: string | null,
  userId: string | null,
  position: PublisherPosition | null,
  enabled: boolean,
) {
  const { sendEvent, deleteEvents } = useCalendarVault()
  const events = useCalendarStore(s => s.events)
  const updateEvent = useCalendarStore(s => s.updateEvent)

  // Refs so the publish callback always reads latest values without re-creating
  const eventsRef = useRef(events)
  const positionRef = useRef(position)
  useEffect(() => { eventsRef.current = events }, [events])
  useEffect(() => { positionRef.current = position }, [position])

  const lastPublishedRef = useRef<{ lat: number; lng: number } | null>(null)

  const publish = useCallback(async (lat: number, lng: number) => {
    if (!eventId || !userId) return
    const event = eventsRef.current.find(e => e.id === eventId)
    if (!event) return

    let mgrs = ''
    try { mgrs = forward([lng, lat], 5) } catch { /* leave empty */ }

    const updatedEvent = {
      ...event,
      field_positions: {
        ...event.field_positions,
        [userId]: { lat, lng, mgrs, timestamp: new Date().toISOString() },
      },
      updated_at: new Date().toISOString(),
    }

    const oldOriginIds = event.originId ? [event.originId] : []
    if (oldOriginIds.length > 0) deleteEvents(oldOriginIds).catch(() => {})

    const newOriginId = await sendEvent('c', updatedEvent).catch(() => null)
    updateEvent(eventId, {
      ...updatedEvent,
      ...(newOriginId ? { originId: newOriginId } : {}),
    })

    lastPublishedRef.current = { lat, lng }
  }, [eventId, userId, updateEvent, sendEvent, deleteEvents])

  // Publish on first fix or significant movement
  useEffect(() => {
    if (!enabled || !position || !eventId || !userId) return

    const last = lastPublishedRef.current
    const moved = !last || distanceMeters(last.lat, last.lng, position.lat, position.lng) >= MOVEMENT_THRESHOLD_M

    if (moved) publish(position.lat, position.lng)
  }, [enabled, position, eventId, userId, publish])

  // Heartbeat — fires regardless of movement to keep last-known fresh
  useEffect(() => {
    if (!enabled || !eventId || !userId) return

    const interval = setInterval(() => {
      const pos = positionRef.current
      if (pos) publish(pos.lat, pos.lng)
    }, HEARTBEAT_MS)

    return () => clearInterval(interval)
  }, [enabled, eventId, userId, publish])

  // Clear anchor on disable so the next enable publishes immediately
  useEffect(() => {
    if (!enabled) lastPublishedRef.current = null
  }, [enabled])
}
