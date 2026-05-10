/**
 * Tests for WaypointIcon SVG string generator used by Leaflet divIcon.
 */

import { describe, it, expect } from 'vitest'
import { waypointIconSvg } from '../WaypointIcon'
import { WAYPOINT_LABELS, WAYPOINT_CATEGORIES } from '../../../Types/MapOverlayTypes'
import type { WaypointType } from '../../../Types/MapOverlayTypes'

describe('expanded waypoint glyph set', () => {
  const ALL: WaypointType[] = [
    'circle', 'cross', 'triangle',
    'friendly', 'enemy', 'neutral',
    'lz', 'pz', 'dz',
    'ccp', 'axp', 'obj', 'rally',
    'hazard', 'target', 'supply', 'vehicle', 'medic', 'comms',
    'casualty',
  ]

  it('every glyph has a human-readable label', () => {
    for (const g of ALL) expect(WAYPOINT_LABELS[g]).toBeTruthy()
  })

  it('every glyph appears in exactly one category', () => {
    const seen = new Set<string>()
    for (const cat of WAYPOINT_CATEGORIES) {
      for (const t of cat.types) {
        expect(seen.has(t)).toBe(false)
        seen.add(t)
      }
    }
    for (const g of ALL) expect(seen.has(g)).toBe(true)
  })

  it('every glyph renders to a valid SVG fragment', () => {
    for (const g of ALL) {
      const svg = waypointIconSvg(g, '#3b82f6')
      expect(svg).toContain('<svg')
      expect(svg).toContain('</svg>')
      expect(svg.length).toBeGreaterThan(50)
    }
  })

  it('falls back to circle for unknown legacy types', () => {
    const svg = waypointIconSvg('not-a-real-type', '#3b82f6')
    expect(svg).toContain('<svg')
    expect(svg).toContain('<circle')
  })

  it('linkedCasualty flag forces the casualty glyph regardless of type', () => {
    // Casualty glyph has the white card with stroke + interior cross + corner stripe.
    const asCasualty = waypointIconSvg('triangle', '#ff0000', 28, false, true)
    expect(asCasualty).toContain('fill="#ffffff"')
    const asTriangle = waypointIconSvg('triangle', '#ff0000', 28, false, false)
    expect(asTriangle).not.toContain('fill="#ffffff"')
  })
})


describe('waypointIconSvg', () => {
  it('returns valid SVG markup', () => {
    const svg = waypointIconSvg('circle', '#3B82F6')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('uses the provided color as fill (inline style so CSS vars resolve)', () => {
    const svg = waypointIconSvg('circle', 'var(--color-themeblue2)')
    expect(svg).toContain('style="fill: var(--color-themeblue2)"')
  })

  it('respects custom size', () => {
    const svg = waypointIconSvg('circle', '#000', 40)
    expect(svg).toContain('width="40"')
    expect(svg).toContain('height="40"')
  })

  it('renders a single shape for circle', () => {
    const svg = waypointIconSvg('circle', '#000', 28)
    // one filled glyph circle (no background disc, no text label)
    expect((svg.match(/<circle /g) ?? []).length).toBe(1)
    expect(svg).not.toContain('<text')
  })

  it('renders two crossed bars for cross', () => {
    const svg = waypointIconSvg('cross', '#000', 28)
    expect((svg.match(/<rect /g) ?? []).length).toBe(2)
  })

  it('renders a single path for triangle', () => {
    const svg = waypointIconSvg('triangle', '#000', 28)
    expect((svg.match(/<path /g) ?? []).length).toBe(1)
    expect(svg).not.toContain('<circle')
  })

  it('adds a selection ring when selected', () => {
    const normal = waypointIconSvg('circle', '#000', 28, false)
    const selected = waypointIconSvg('circle', '#000', 28, true)
    expect((selected.match(/<circle /g) ?? []).length).toBe(
      (normal.match(/<circle /g) ?? []).length + 1,
    )
  })

  it('falls back to circle for unknown legacy waypoint types', () => {
    const legacy = waypointIconSvg('hlz', '#000', 28)
    const circle = waypointIconSvg('circle', '#000', 28)
    expect(legacy).toBe(circle)
  })
})
