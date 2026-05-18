import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureMissionOverlay, isFieldEvent } from '../missionOverlayBootstrap'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import type { LocalMapOverlay } from '../../Types/MapOverlayTypes'

const NOW = '2026-05-10T12:00:00.000Z'

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'ev-1',
    clinic_id: 'cl-1',
    title: 'Op Rake',
    description: null,
    category: 'mission',
    status: 'pending',
    start_time: '2026-06-01T08:00:00Z',
    end_time: '2026-06-01T18:00:00Z',
    all_day: false,
    location: null,
    opord_notes: null,
    uniform: null,
    report_time: null,
    assigned_to: ['u-1'],
    property_item_ids: [],
    structured_location: null,
    resource_allocations: null,
    field_positions: null,
    medevac_data: null,
    created_by: 'u-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as CalendarEvent
}

const writeOverlay = vi.fn()

describe('isFieldEvent', () => {
  it('returns true for mission / training / range', () => {
    expect(isFieldEvent(event({ category: 'mission' }))).toBe(true)
    expect(isFieldEvent(event({ category: 'training' }))).toBe(true)
    expect(isFieldEvent(event({ category: 'range' }))).toBe(true)
  })

  it('returns false for non-field categories', () => {
    expect(isFieldEvent(event({ category: 'huddle' }))).toBe(false)
    expect(isFieldEvent(event({ category: 'medevac' }))).toBe(false)
    expect(isFieldEvent(event({ category: 'leave' }))).toBe(false)
  })
})

describe('ensureMissionOverlay', () => {
  beforeEach(() => writeOverlay.mockReset())

  it('returns the existing overlay_id when one is already linked (no writes)', async () => {
    const ev = event({ structured_location: { overlay_id: 'ov-existing' } })
    const r = await ensureMissionOverlay({ event: ev, userId: 'u-1', fallbackCenter: [0, 0], writeOverlay })
    expect(r.overlayId).toBe('ov-existing')
    expect(r.created).toBe(false)
    expect(writeOverlay).not.toHaveBeenCalled()
  })

  it('creates a new overlay when none is linked', async () => {
    writeOverlay.mockResolvedValueOnce({ id: 'irrelevant' } as Partial<LocalMapOverlay>)
    const r = await ensureMissionOverlay({ event: event(), userId: 'u-1', fallbackCenter: [38.9, -77.0], writeOverlay })
    expect(r.created).toBe(true)
    expect(r.overlayId).toBeTruthy()
    expect(writeOverlay).toHaveBeenCalledOnce()
    const args = writeOverlay.mock.calls[0][0]
    expect(args.clinicId).toBe('cl-1')
    expect(args.name).toContain('Op Rake')
    expect(args.name).toContain('2026-06-01')
    expect(args.features).toEqual([])
    expect(args.center).toEqual([38.9, -77.0])
  })

  it('falls back to a category-prefixed name when title is empty', async () => {
    writeOverlay.mockResolvedValueOnce({} as Partial<LocalMapOverlay>)
    await ensureMissionOverlay({ event: event({ title: '' }), userId: 'u-1', fallbackCenter: [0, 0], writeOverlay })
    const args = writeOverlay.mock.calls[0][0]
    expect(args.name).toMatch(/^Mission · 2026-06-01$/)
  })

  it('errors out when given a non-field event category', async () => {
    const r = await ensureMissionOverlay({
      event: event({ category: 'huddle' }),
      userId: 'u-1',
      fallbackCenter: [0, 0],
      writeOverlay,
    })
    expect(r.created).toBe(false)
    expect(r.error).toBe('Event is not a field-type category')
    expect(writeOverlay).not.toHaveBeenCalled()
  })

  it('propagates a writeOverlay failure', async () => {
    writeOverlay.mockResolvedValueOnce(null)
    const r = await ensureMissionOverlay({ event: event(), userId: 'u-1', fallbackCenter: [0, 0], writeOverlay })
    expect(r.created).toBe(false)
    expect(r.error).toBe('Failed to create overlay')
    expect(r.overlayId).toBe('')
  })
})
