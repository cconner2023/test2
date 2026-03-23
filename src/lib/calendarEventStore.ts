/**
 * Calendar event IndexedDB persistence.
 *
 * Stores the materialized calendar event list locally so the calendar
 * renders instantly on mount without waiting for message history replay.
 * This is a projection cache — the Signal Protocol message stream is the
 * source of truth.
 *
 * Database: adtmc-calendar-events
 * Store:    events (keyed by event id)
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../Utilities/Logger'
import { createIdbSingleton } from './idbFactory'
import type { CalendarEvent } from '../Types/CalendarTypes'

const logger = createLogger('CalendarEventStore')

// ---- Schema ----

interface CalendarTombstone {
  id: string
  deletedAt: number
}

interface CalendarEventsDB extends DBSchema {
  events: {
    key: string
    value: CalendarEvent
  }
  tombstones: {
    key: string
    value: CalendarTombstone
  }
}

const DB_NAME = 'adtmc-calendar-events'
const DB_VERSION = 2

const { getDb, destroy: destroyDb } = createIdbSingleton<CalendarEventsDB>(
  DB_NAME,
  DB_VERSION,
  {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('events', { keyPath: 'id' })
      }
      if (oldVersion < 2) {
        db.createObjectStore('tombstones', { keyPath: 'id' })
      }
    },
  },
)

// ---- Public API ----

/** Load all persisted calendar events. */
export async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const db = await getDb()
    return db.getAll('events')
  } catch (e) {
    logger.warn('Failed to load calendar events from IDB:', e)
    return []
  }
}

/** Upsert a single event (granular write for middleware). */
export async function putCalendarEvent(event: CalendarEvent): Promise<void> {
  try {
    const db = await getDb()
    await db.put('events', event)
  } catch (e) {
    logger.warn('Failed to put calendar event in IDB:', e)
  }
}

/** Delete a single event by ID (granular write for middleware). */
export async function deleteCalendarEvent(id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('events', id)
  } catch (e) {
    logger.warn('Failed to delete calendar event from IDB:', e)
  }
}

/** Replace the entire persisted event list (bulk hydration / reset). */
export async function saveCalendarEvents(events: CalendarEvent[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('events', 'readwrite')
    await tx.store.clear()
    for (const event of events) {
      tx.store.put(event)
    }
    await tx.done
    logger.info(`Saved ${events.length} calendar events to IDB`)
  } catch (e) {
    logger.warn('Failed to save calendar events to IDB:', e)
  }
}

/** Clear all persisted events (e.g. on sign-out). */
export async function clearCalendarEvents(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('events')
    logger.info('Cleared calendar events from IDB')
  } catch (e) {
    logger.warn('Failed to clear calendar events from IDB:', e)
  }
}

/** Destroy the entire database (sign-out / account wipe). */
export async function destroyCalendarEventStore(): Promise<void> {
  await destroyDb()
}

// ---- Tombstone API ----

/** Record a durable deletion so replayed messages cannot resurrect the event. */
export async function addCalendarTombstone(eventId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.put('tombstones', { id: eventId, deletedAt: Date.now() })
  } catch (e) {
    logger.warn('Failed to write calendar tombstone:', e)
  }
}

/** Return true if the event has been tombstoned. */
export async function isCalendarTombstoned(eventId: string): Promise<boolean> {
  try {
    const db = await getDb()
    const entry = await db.get('tombstones', eventId)
    return entry !== undefined
  } catch {
    return false
  }
}

/** Load all tombstoned event IDs into a Set for O(1) in-memory lookups. */
export async function loadCalendarTombstones(): Promise<Set<string>> {
  try {
    const db = await getDb()
    const all = await db.getAll('tombstones')
    return new Set(all.map(t => t.id))
  } catch (e) {
    logger.warn('Failed to load calendar tombstones:', e)
    return new Set()
  }
}

/** Prune tombstones older than maxAgeDays to keep the store bounded. */
export async function clearExpiredTombstones(maxAgeDays = 30): Promise<void> {
  try {
    const db = await getDb()
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const all = await db.getAll('tombstones')
    const tx = db.transaction('tombstones', 'readwrite')
    for (const entry of all) {
      if (entry.deletedAt < cutoff) tx.store.delete(entry.id)
    }
    await tx.done
  } catch (e) {
    logger.warn('Failed to clear expired tombstones:', e)
  }
}
