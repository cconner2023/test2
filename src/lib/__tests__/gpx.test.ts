// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseGPX, serializeGPX } from '../gpx'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'

const NOW = '2026-05-09T12:00:00.000Z'

function fixture(): OverlayFeature[] {
  return [
    {
      id: 'wp-1', overlay_id: 'ov-1', type: 'waypoint',
      geometry: [[38.8977, -77.0365]],
      label: 'White House',
      style: { color: '#ff0000', weight: 3, opacity: 1 },
      waypoint_type: 'cross',
      notes: 'Test description',
      created_at: NOW, updated_at: NOW,
    },
    {
      id: 'rt-1', overlay_id: 'ov-1', type: 'route',
      geometry: [[38.89, -77.03], [38.90, -77.04], [38.91, -77.05]],
      label: 'Approach',
      style: { color: '#00ff00', weight: 3, opacity: 1 },
      created_at: NOW, updated_at: NOW,
    },
    {
      id: 'ar-1', overlay_id: 'ov-1', type: 'area',
      geometry: [[38.88, -77.02], [38.88, -77.04], [38.90, -77.04], [38.90, -77.02]],
      label: 'AO',
      style: { color: '#0000ff', weight: 3, opacity: 1 },
      created_at: NOW, updated_at: NOW,
    },
  ]
}

describe('GPX round-trip', () => {
  it('preserves geometry, type, label, color, glyph, id', () => {
    const original = fixture()
    const xml = serializeGPX(original, 'Test overlay')
    const { features, suggestedName } = parseGPX(xml, 'ov-1')

    expect(suggestedName).toBe('Test overlay')
    expect(features).toHaveLength(3)

    const wp = features.find(f => f.type === 'waypoint')!
    expect(wp.id).toBe('wp-1')
    expect(wp.label).toBe('White House')
    expect(wp.notes).toBe('Test description')
    expect(wp.style.color).toBe('#ff0000')
    expect(wp.waypoint_type).toBe('cross')
    expect(wp.geometry).toEqual([[38.8977, -77.0365]])

    const rt = features.find(f => f.type === 'route')!
    expect(rt.id).toBe('rt-1')
    expect(rt.label).toBe('Approach')
    expect(rt.geometry).toHaveLength(3)
    expect(rt.style.color).toBe('#00ff00')

    const ar = features.find(f => f.type === 'area')!
    expect(ar.id).toBe('ar-1')
    expect(ar.label).toBe('AO')
    expect(ar.geometry).toHaveLength(4)
    expect(ar.style.color).toBe('#0000ff')
  })

  it('escapes XML-unsafe characters in labels', () => {
    const features: OverlayFeature[] = [{
      id: 'wp-x', overlay_id: 'ov-1', type: 'waypoint',
      geometry: [[0, 0]], label: 'A & "B" <C>',
      style: { color: '#ffffff', weight: 3, opacity: 1 },
      created_at: NOW, updated_at: NOW,
    }]
    const xml = serializeGPX(features, 'name')
    expect(xml).not.toContain('A & "B" <C>')
    const { features: parsed } = parseGPX(xml, 'ov-1')
    expect(parsed[0].label).toBe('A & "B" <C>')
  })

  it('throws on invalid GPX', () => {
    expect(() => parseGPX('<not-gpx/>', 'ov-1')).toThrow(/expected <gpx>/)
  })

  it('round-trips tc3_card_id via beacon-prefixed extension', () => {
    const features: OverlayFeature[] = [{
      id: 'wp-cas', overlay_id: 'ov-1', type: 'waypoint',
      geometry: [[38.89, -77.05]],
      label: 'Casualty A',
      style: { color: '#ff0000', weight: 3, opacity: 1 },
      waypoint_type: 'casualty',
      tc3_card_id: 'tc3-9c1f',
      created_at: NOW, updated_at: NOW,
    }]
    const xml = serializeGPX(features, 'ov')
    expect(xml).toContain('<beacon:tc3CardId>tc3-9c1f</beacon:tc3CardId>')
    const { features: parsed } = parseGPX(xml, 'ov-1')
    expect(parsed[0].tc3_card_id).toBe('tc3-9c1f')
    expect(parsed[0].waypoint_type).toBe('casualty')
  })

  it('parses external GPX without beacon extensions (assigns new ids)', () => {
    const xml = `<?xml version="1.0"?>
      <gpx version="1.1" creator="OtherApp" xmlns="http://www.topografix.com/GPX/1/1">
        <wpt lat="40" lon="-75"><name>External</name></wpt>
      </gpx>`
    const { features } = parseGPX(xml, 'ov-1')
    expect(features).toHaveLength(1)
    expect(features[0].label).toBe('External')
    expect(features[0].id).toBeTruthy()
  })
})
