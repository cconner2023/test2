import { describe, it, expect } from 'vitest'
import { cloneFeatureForOverlay } from '../cloneFeature'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'

const NOW = '2026-06-09T12:00:00.000Z'

function feat(overrides: Partial<OverlayFeature> = {}): OverlayFeature {
  return {
    id: 'src-1', overlay_id: 'ov-src', type: 'route',
    geometry: [[38.8977, -77.0365], [38.9, -77.04]],
    label: 'Route Bravo',
    style: { color: '#ff0000', weight: 3, opacity: 1 },
    notes: 'recon leg',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('cloneFeatureForOverlay', () => {
  it('assigns a fresh id and the target overlay', () => {
    const c = cloneFeatureForOverlay(feat(), 'ov-dest', { id: 'new-1', now: NOW })
    expect(c.id).toBe('new-1')
    expect(c.id).not.toBe('src-1')
    expect(c.overlay_id).toBe('ov-dest')
  })

  it('stamps created_at/updated_at to now', () => {
    const c = cloneFeatureForOverlay(feat(), 'ov-dest', { id: 'new-1', now: NOW })
    expect(c.created_at).toBe(NOW)
    expect(c.updated_at).toBe(NOW)
  })

  it('carries label, notes, style, waypoint_type verbatim', () => {
    const c = cloneFeatureForOverlay(
      feat({ type: 'waypoint', waypoint_type: 'pz', geometry: [[1, 2]] }),
      'ov-dest', { id: 'new-1', now: NOW },
    )
    expect(c.label).toBe('Route Bravo')
    expect(c.notes).toBe('recon leg')
    expect(c.waypoint_type).toBe('pz')
    expect(c.style).toEqual({ color: '#ff0000', weight: 3, opacity: 1 })
  })

  it('carries tc3_card_id (opaque, no PHI) so a copied casualty pin points the same card', () => {
    const c = cloneFeatureForOverlay(
      feat({ type: 'waypoint', tc3_card_id: 'card-xyz' }),
      'ov-dest', { id: 'new-1', now: NOW },
    )
    expect(c.tc3_card_id).toBe('card-xyz')
  })

  it('deep-copies geometry and style — mutating the copy never touches the source', () => {
    const src = feat()
    const c = cloneFeatureForOverlay(src, 'ov-dest', { id: 'new-1', now: NOW })
    expect(c.geometry).toEqual(src.geometry)
    expect(c.geometry).not.toBe(src.geometry)
    c.geometry[0][0] = 0
    c.style.color = '#0000ff'
    expect(src.geometry[0][0]).toBe(38.8977)
    expect(src.style.color).toBe('#ff0000')
  })

  it('generates a real uuid when id is not injected', () => {
    const a = cloneFeatureForOverlay(feat(), 'ov-dest')
    const b = cloneFeatureForOverlay(feat(), 'ov-dest')
    expect(a.id).not.toBe(b.id)
    expect(a.id.length).toBeGreaterThan(10)
  })
})
