import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  saveOverlay: vi.fn(),
}))

vi.mock('../mapOverlayService', () => ({
  saveOverlay: mocks.saveOverlay,
}))

import { ensureMissionOverlay, isFieldEvent } from '../missionOverlayBootstrap'
import type { CalendarEvent } from '../../Types/CalendarTypes'

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
    aft_result: null,
    aft_target: null,
    workout_id: null,
    workout_log: null,
    created_by: 'u-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as CalendarEvent
}

describe('isFieldEvent', () => {
  it('returns true for mission / training / range', () => {
    expect(isFieldEvent(event({ category: 'mission' }))).toBe(true)
    expect(isFieldEvent(event({ category: 'training' }))).toBe(true)
    expect(isFieldEvent(event({ category: 'range' }))).toBe(true)
  })

  it('returns false for non-field categories', () => {
    expect(isFieldEvent(event({ category: 'huddle' }))).toBe(false)
    expect(isFieldEvent(event({ category: 'medevac' }))).toBe(false)
    expect(isFieldEvent(event({ category: 'workout' }))).toBe(false)
    expect(isFieldEvent(event({ category: 'leave' }))).toBe(false)
  })
})

describe('ensureMissionOverlay', () => {
  beforeEach(() => mocks.saveOverlay.mockReset())

  it('returns the existing overlay_id when one is already linked (no writes)', async () => {
    const ev = event({ structured_location: { overlay_id: 'ov-existing' } })
    const r = await ensureMissionOverlay({ event: ev, userId: 'u-1', fallbackCenter: [0, 0] })
    expect(r.overlayId).toBe('ov-existing')
    expect(r.created).toBe(false)
    expect(mocks.saveOverlay).not.toHaveBeenCalled()
  })

  it('creates a new overlay when none is linked', async () => {
    mocks.saveOverlay.mockResolvedValueOnce({ ok: true, data: { id: 'irrelevant' } })
    const r = await ensureMissionOverlay({ event: event(), userId: 'u-1', fallbackCenter: [38.9, -77.0] })
    expect(r.created).toBe(true)
    expect(r.overlayId).toBeTruthy()
    expect(mocks.saveOverlay).toHaveBeenCalledOnce()
    const args = mocks.saveOverlay.mock.calls[0][0]
    expect(args.clinicId).toBe('cl-1')
    expect(args.userId).toBe('u-1')
    expect(args.name).toContain('Op Rake')
    expect(args.name).toContain('2026-06-01')
    expect(args.features).toEqual([])
    expect(args.center).toEqual([38.9, -77.0])
  })

  it('falls back to a category-prefixed name when title is empty', async () => {
    mocks.saveOverlay.mockResolvedValueOnce({ ok: true, data: {} })
    await ensureMissionOverlay({ event: event({ title: '' }), userId: 'u-1', fallbackCenter: [0, 0] })
    const args = mocks.saveOverlay.mock.calls[0][0]
    expect(args.name).toMatch(/^Mission · 2026-06-01$/)
  })

  it('errors out when given a non-field event category', async () => {
    const r = await ensureMissionOverlay({
      event: event({ category: 'huddle' }),
      userId: 'u-1',
      fallbackCenter: [0, 0],
    })
    expect(r.created).toBe(false)
    expect(r.error).toBe('Event is not a field-type category')
    expect(mocks.saveOverlay).not.toHaveBeenCalled()
  })

  it('propagates a saveOverlay failure', async () => {
    mocks.saveOverlay.mockResolvedValueOnce({ ok: false, error: 'IDB write failed' })
    const r = await ensureMissionOverlay({ event: event(), userId: 'u-1', fallbackCenter: [0, 0] })
    expect(r.created).toBe(false)
    expect(r.error).toBe('IDB write failed')
    expect(r.overlayId).toBe('')
  })
})
