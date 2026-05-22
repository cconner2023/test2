import { describe, it, expect } from 'vitest'
import {
  addFeatureLink,
  addOverlayLink,
  explicitlyLinkedFeatureIds,
  isFeatureLinked,
  removeFeatureLink,
  removeOverlayLink,
  resolveOverlayLink,
} from '../eventLinks'
import type { CalendarEvent } from '../../Types/CalendarTypes'

const NOW = '2026-05-22T12:00:00.000Z'

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'ev-1',
    clinic_id: 'cl-1',
    title: 'Op Rake',
    description: null,
    category: 'mission',
    status: 'pending',
    start_time: NOW,
    end_time: NOW,
    all_day: false,
    location: null,
    opord_notes: null,
    uniform: null,
    report_time: null,
    assigned_to: ['u-1'],
    property_item_ids: [],
    structured_location: null,
    linked_overlays: null,
    linked_features: null,
    resource_allocations: null,
    field_positions: null,
    medevac_data: null,
    created_by: 'u-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as CalendarEvent
}

describe('resolveOverlayLink', () => {
  it("returns 'full' when overlay is in linked_overlays", () => {
    expect(resolveOverlayLink(event({ linked_overlays: ['ov-1'] }), 'ov-1')).toBe('full')
  })

  it("returns 'partial' when only a feature of the overlay is linked", () => {
    const e = event({ linked_features: [{ overlay_id: 'ov-1', feature_id: 'f-1' }] })
    expect(resolveOverlayLink(e, 'ov-1')).toBe('partial')
  })

  it("prefers 'full' over 'partial' when both apply", () => {
    const e = event({
      linked_overlays: ['ov-1'],
      linked_features: [{ overlay_id: 'ov-1', feature_id: 'f-1' }],
    })
    expect(resolveOverlayLink(e, 'ov-1')).toBe('full')
  })

  it("returns 'none' when no link", () => {
    expect(resolveOverlayLink(event(), 'ov-1')).toBe('none')
  })

  it('ignores structured_location for link resolution', () => {
    const e = event({ structured_location: { overlay_id: 'ov-1' } })
    expect(resolveOverlayLink(e, 'ov-1')).toBe('none')
  })
})

describe('isFeatureLinked', () => {
  it('returns true via overlay-implied link', () => {
    expect(isFeatureLinked(event({ linked_overlays: ['ov-1'] }), 'ov-1', 'f-1')).toBe(true)
  })

  it('returns true via explicit feature link', () => {
    const e = event({ linked_features: [{ overlay_id: 'ov-1', feature_id: 'f-1' }] })
    expect(isFeatureLinked(e, 'ov-1', 'f-1')).toBe(true)
  })

  it('returns false when feature anchor is for a different overlay', () => {
    const e = event({ linked_features: [{ overlay_id: 'ov-2', feature_id: 'f-1' }] })
    expect(isFeatureLinked(e, 'ov-1', 'f-1')).toBe(false)
  })

  it('returns false when no link', () => {
    expect(isFeatureLinked(event(), 'ov-1', 'f-1')).toBe(false)
  })
})

describe('explicitlyLinkedFeatureIds', () => {
  it('returns ids scoped to the given overlay only', () => {
    const e = event({
      linked_features: [
        { overlay_id: 'ov-1', feature_id: 'f-1' },
        { overlay_id: 'ov-1', feature_id: 'f-2' },
        { overlay_id: 'ov-2', feature_id: 'f-3' },
      ],
    })
    expect(explicitlyLinkedFeatureIds(e, 'ov-1').sort()).toEqual(['f-1', 'f-2'])
  })

  it('does NOT include features implied by linked_overlays — explicit only', () => {
    const e = event({ linked_overlays: ['ov-1'] })
    expect(explicitlyLinkedFeatureIds(e, 'ov-1')).toEqual([])
  })

  it('returns empty array when nothing linked', () => {
    expect(explicitlyLinkedFeatureIds(event(), 'ov-1')).toEqual([])
  })
})

describe('addOverlayLink', () => {
  it('appends the overlay id', () => {
    const e = addOverlayLink(event(), 'ov-1')
    expect(e.linked_overlays).toEqual(['ov-1'])
  })

  it('is idempotent (returns the same event when already linked)', () => {
    const base = event({ linked_overlays: ['ov-1'] })
    const next = addOverlayLink(base, 'ov-1')
    expect(next).toBe(base)
  })

  it('preserves prior overlays', () => {
    const e = addOverlayLink(event({ linked_overlays: ['ov-1'] }), 'ov-2')
    expect(e.linked_overlays).toEqual(['ov-1', 'ov-2'])
  })
})

describe('removeOverlayLink', () => {
  it('removes the overlay id', () => {
    const e = removeOverlayLink(event({ linked_overlays: ['ov-1', 'ov-2'] }), 'ov-1')
    expect(e.linked_overlays).toEqual(['ov-2'])
  })

  it('is a no-op when not present', () => {
    const base = event({ linked_overlays: ['ov-1'] })
    expect(removeOverlayLink(base, 'ov-2')).toBe(base)
  })

  it('does not touch linked_features when removing an overlay link', () => {
    const e = removeOverlayLink(
      event({
        linked_overlays: ['ov-1'],
        linked_features: [{ overlay_id: 'ov-1', feature_id: 'f-1' }],
      }),
      'ov-1',
    )
    expect(e.linked_features).toEqual([{ overlay_id: 'ov-1', feature_id: 'f-1' }])
  })
})

describe('addFeatureLink', () => {
  it('appends a feature anchor', () => {
    const e = addFeatureLink(event(), 'ov-1', 'f-1')
    expect(e.linked_features).toEqual([{ overlay_id: 'ov-1', feature_id: 'f-1' }])
  })

  it('is idempotent', () => {
    const base = event({ linked_features: [{ overlay_id: 'ov-1', feature_id: 'f-1' }] })
    expect(addFeatureLink(base, 'ov-1', 'f-1')).toBe(base)
  })
})

describe('removeFeatureLink', () => {
  it('drops the matching anchor', () => {
    const e = removeFeatureLink(
      event({
        linked_features: [
          { overlay_id: 'ov-1', feature_id: 'f-1' },
          { overlay_id: 'ov-1', feature_id: 'f-2' },
        ],
      }),
      'ov-1',
      'f-1',
    )
    expect(e.linked_features).toEqual([{ overlay_id: 'ov-1', feature_id: 'f-2' }])
  })

  it('is a no-op when anchor not present', () => {
    const base = event({ linked_features: [{ overlay_id: 'ov-1', feature_id: 'f-1' }] })
    expect(removeFeatureLink(base, 'ov-1', 'f-2')).toBe(base)
  })
})
