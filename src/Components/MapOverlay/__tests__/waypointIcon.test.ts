/**
 * Tests for WaypointIcon SVG string generator used by Leaflet divIcon.
 */

import { describe, it, expect } from 'vitest'
import { waypointIconSvg } from '../WaypointIcon'

describe('waypointIconSvg', () => {
  it('returns valid SVG markup', () => {
    const svg = waypointIconSvg('generic', '#3B82F6')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('includes the waypoint type abbreviation', () => {
    expect(waypointIconSvg('hlz', '#3B82F6')).toContain('HLZ')
    expect(waypointIconSvg('ccp', '#FF0000')).toContain('CCP')
    expect(waypointIconSvg('generic', '#000')).toContain('WPT')
  })

  it('uses the provided color as fill', () => {
    const svg = waypointIconSvg('hlz', 'rgba(21,142,172,1)')
    expect(svg).toContain('fill="rgba(21,142,172,1)"')
  })

  it('respects custom size', () => {
    const svg = waypointIconSvg('hlz', '#000', 40)
    expect(svg).toContain('width="40"')
    expect(svg).toContain('height="40"')
  })

  it('adds selection ring when selected', () => {
    const normal = waypointIconSvg('hlz', '#000', 28, false)
    const selected = waypointIconSvg('hlz', '#000', 28, true)
    expect(normal).not.toContain('stroke="#FFFFFF"')
    expect(selected).toContain('stroke="#FFFFFF"')
  })

  it('renders all standard waypoint types', () => {
    const types = ['hlz', 'ccp', 'role1', 'role2', 'role3', 'rp', 'sp', 'cp', 'generic'] as const
    for (const t of types) {
      const svg = waypointIconSvg(t, '#000')
      expect(svg).toContain('<svg')
    }
  })
})
