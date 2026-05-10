// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseKML, serializeKML } from '../kml'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'

const NOW = '2026-05-09T12:00:00.000Z'

function fixture(): OverlayFeature[] {
  return [
    {
      id: 'wp-1', overlay_id: 'ov-1', type: 'waypoint',
      geometry: [[38.8977, -77.0365]],
      label: 'White House',
      style: { color: '#ff0000', weight: 3, opacity: 1 },
      waypoint_type: 'triangle',
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

describe('KML round-trip', () => {
  it('preserves geometry, type, label, glyph, id, and color', () => {
    const original = fixture()
    const xml = serializeKML(original, 'Test overlay')
    const { features, suggestedName } = parseKML(xml, 'ov-1')

    expect(suggestedName).toBe('Test overlay')
    expect(features).toHaveLength(3)

    const wp = features.find(f => f.type === 'waypoint')!
    expect(wp.id).toBe('wp-1')
    expect(wp.label).toBe('White House')
    expect(wp.style.color).toBe('#ff0000')
    expect(wp.waypoint_type).toBe('triangle')
    expect(wp.geometry).toEqual([[38.8977, -77.0365]])

    const rt = features.find(f => f.type === 'route')!
    expect(rt.id).toBe('rt-1')
    expect(rt.geometry).toHaveLength(3)
    expect(rt.style.color).toBe('#00ff00')

    const ar = features.find(f => f.type === 'area')!
    expect(ar.id).toBe('ar-1')
    expect(ar.geometry).toHaveLength(4)
    expect(ar.style.color).toBe('#0000ff')
  })

  it('round-trips tc3_card_id via beacon-prefixed ExtendedData', () => {
    const features: OverlayFeature[] = [{
      id: 'wp-cas', overlay_id: 'ov-1', type: 'waypoint',
      geometry: [[38.89, -77.05]],
      label: 'Casualty A',
      style: { color: '#ff0000', weight: 3, opacity: 1 },
      waypoint_type: 'casualty',
      tc3_card_id: 'tc3-9c1f',
      created_at: NOW, updated_at: NOW,
    }]
    const xml = serializeKML(features, 'ov')
    expect(xml).toContain('beacon:tc3CardId')
    const { features: parsed } = parseKML(xml, 'ov-1')
    expect(parsed[0].tc3_card_id).toBe('tc3-9c1f')
    expect(parsed[0].waypoint_type).toBe('casualty')
  })

  it('parses external KML without beacon extensions', () => {
    const xml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>External</name>
          <Placemark>
            <name>External point</name>
            <Point><coordinates>-75.0,40.0,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <name>Line</name>
            <LineString><coordinates>-75.0,40.0 -75.1,40.1</coordinates></LineString>
          </Placemark>
        </Document>
      </kml>`
    const { features, suggestedName } = parseKML(xml, 'ov-1')
    expect(suggestedName).toBe('External')
    expect(features).toHaveLength(2)
    expect(features[0].type).toBe('waypoint')
    expect(features[0].geometry).toEqual([[40, -75]])
    expect(features[1].type).toBe('route')
    expect(features[1].geometry).toEqual([[40, -75], [40.1, -75.1]])
  })

  it('throws on invalid KML', () => {
    expect(() => parseKML('<not-kml/>', 'ov-1')).toThrow(/expected <kml>/)
  })

  it('escapes XML-unsafe characters in labels', () => {
    const features: OverlayFeature[] = [{
      id: 'wp-x', overlay_id: 'ov-1', type: 'waypoint',
      geometry: [[0, 0]], label: 'A & "B" <C>',
      style: { color: '#ffffff', weight: 3, opacity: 1 },
      created_at: NOW, updated_at: NOW,
    }]
    const xml = serializeKML(features, 'name')
    const { features: parsed } = parseKML(xml, 'ov-1')
    expect(parsed[0].label).toBe('A & "B" <C>')
  })

  it('decodes KML AABBGGRR color back to #RRGGBB', () => {
    const xml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Style id="s1"><LineStyle><color>ff112233</color></LineStyle></Style>
          <Placemark>
            <name>Colored</name>
            <styleUrl>#s1</styleUrl>
            <Point><coordinates>-75,40,0</coordinates></Point>
          </Placemark>
        </Document>
      </kml>`
    const { features } = parseKML(xml, 'ov-1')
    // KML 'ff112233' = alpha ff, blue 11, green 22, red 33 → #332211
    expect(features[0].style.color).toBe('#332211')
  })
})
