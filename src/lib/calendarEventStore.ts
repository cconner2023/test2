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

interface CalendarEventsDB extends DBSchema {
  events: {
    key: string
    value: CalendarEvent
  }
}

const DB_NAME = 'adtmc-calendar-events'
const DB_VERSION = 1

const { getDb, destroy: destroyDb } = createIdbSingleton<CalendarEventsDB>(
  DB_NAME,
  DB_VERSION,
  {
    upgrade(db) {
      db.createObjectStore('events', { keyPath: 'id' })
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

/** Replace the entire persisted event list. */
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
