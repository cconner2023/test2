import { describe, it, expect } from 'vitest'
import { buildMedevacFromPin } from '../medevacFromPin'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'

const NOW = '2026-05-10T12:00:00.000Z'

function pin(overrides: Partial<OverlayFeature> = {}): OverlayFeature {
  return {
    id: 'wp-pz', overlay_id: 'ov-1', type: 'waypoint',
    geometry: [[38.8977, -77.0365]],
    label: 'PZ Bravo',
    style: { color: '#ff0000', weight: 3, opacity: 1 },
    waypoint_type: 'pz',
    created_at: NOW, updated_at: NOW,
    ...overrides,
  }
}

describe('buildMedevacFromPin', () => {
  it('pre-populates l1 with the pin\'s MGRS grid', () => {
    const r = buildMedevacFromPin(pin(), { overlayId: 'ov-1' })
    expect(r.error).toBeUndefined()
    expect(r.mgrs).toBeTruthy()
    expect(r.req.l1).toBe(r.mgrs)
    // DC area is in 18S grid square.
    expect(r.req.l1.startsWith('18S')).toBe(true)
  })

  it('populates cross-domain link fields', () => {
    const r = buildMedevacFromPin(pin(), { overlayId: 'ov-99' })
    expect(r.req.featureId).toBe('wp-pz')
    expect(r.req.overlayId).toBe('ov-99')
  })

  it('carries through tc3_card_id from the pin when present', () => {
    const r = buildMedevacFromPin(pin({ tc3_card_id: 'tc3-aaaa' }), { overlayId: 'ov-1' })
    expect(r.req.tc3CardId).toBe('tc3-aaaa')
  })

  it('uses the pin label as l1d (description) when not already set', () => {
    const r = buildMedevacFromPin(pin(), { overlayId: 'ov-1' })
    expect(r.req.l1d).toBe('PZ Bravo')
  })

  it('preserves an existing l1d on the base request', () => {
    const base = { ...buildMedevacFromPin(pin(), { overlayId: 'ov-1' }).req, l1d: 'Existing description' }
    const r = buildMedevacFromPin(pin({ label: 'New label' }), { overlayId: 'ov-1', base })
    expect(r.req.l1d).toBe('Existing description')
  })

  it('errors when the feature is not a waypoint', () => {
    const route: OverlayFeature = { ...pin(), type: 'route', geometry: [[0,0],[1,1]] }
    const r = buildMedevacFromPin(route, { overlayId: 'ov-1' })
    expect(r.error).toBe('Feature has no waypoint coordinate')
  })

  it('errors when the waypoint has empty geometry', () => {
    const r = buildMedevacFromPin(pin({ geometry: [] }), { overlayId: 'ov-1' })
    expect(r.error).toBe('Feature has no waypoint coordinate')
  })

  it('honors a lower mgrsPrecision', () => {
    const r4 = buildMedevacFromPin(pin(), { overlayId: 'ov-1', mgrsPrecision: 4 })
    const r5 = buildMedevacFromPin(pin(), { overlayId: 'ov-1', mgrsPrecision: 5 })
    expect(r4.mgrs!.length).toBeLessThan(r5.mgrs!.length)
  })
})
