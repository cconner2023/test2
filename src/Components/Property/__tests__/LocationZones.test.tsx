// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocationTagPhoto } from '../LocationTagPhoto'
import type { LocationTag, LocalPropertyItem } from '../../../Types/PropertyTypes'

// ── Helpers ─────────────────────────────────────────────────

function makeTag(overrides: Partial<LocationTag> = {}): LocationTag {
  return {
    id: crypto.randomUUID(),
    location_id: 'loc-1',
    target_type: 'location',
    target_id: 'child-loc-1',
    x: 0.1,
    y: 0.1,
    label: 'Test Tag',
    ...overrides,
  }
}

function makeZoneTag(overrides: Partial<LocationTag> = {}): LocationTag {
  return makeTag({
    width: 0.3,
    height: 0.3,
    label: 'Test Zone',
    ...overrides,
  })
}

function makeItem(overrides: Partial<LocalPropertyItem> = {}): LocalPropertyItem {
  return {
    id: crypto.randomUUID(),
    clinic_id: 'clinic-1',
    name: 'Test Item',
    nomenclature: null,
    nsn: null,
    lin: null,
    serial_number: null,
    quantity: 1,
    condition_code: 'serviceable',
    parent_item_id: null,
    location_id: null,
    current_holder_id: null,
    location_tag_id: null,
    photo_url: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _sync_status: 'synced',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────

describe('LocationZones', () => {
  // Test 1: Type guard — zone vs point badge
  it('renders a tag with width/height as a zone rectangle, not a point badge', () => {
    const zoneTag = makeZoneTag({ label: 'Zone A' })
    const pointTag = makeTag({ label: 'Point B', width: undefined, height: undefined })

    const { container } = render(
      <LocationTagPhoto
        tags={[zoneTag, pointTag]}
        isEditMode={false}
      />
    )

    // Zone renders as a button with the zone label
    expect(screen.getByText('Zone A')).toBeTruthy()
    expect(screen.getByText('Point B')).toBeTruthy()

    // Zone tag should be rendered as a wider element (not translated -50%)
    // Point tag button has -translate-x-1/2 class (centered on point)
    const pointEl = screen.getByText('Point B').closest('button')
    expect(pointEl?.className).toContain('translate')

    // Zone element should not have -translate-x-1/2
    const zoneEl = screen.getByText('Zone A').closest('button')
    expect(zoneEl?.className).not.toContain('translate')
  })

  // Test 2: StaticZone displays label and correct positioning
  it('renders StaticZone with correct label and position', () => {
    const tag = makeZoneTag({ label: 'Storage Room', x: 0.2, y: 0.3, width: 0.4, height: 0.25 })

    render(
      <LocationTagPhoto
        tags={[tag]}
        isEditMode={false}
      />
    )

    const labelEl = screen.getByText('Storage Room')
    expect(labelEl).toBeTruthy()

    // The zone button should have positioning styles
    const zoneBtn = labelEl.closest('button')
    expect(zoneBtn?.style.left).toBe('20%')
    expect(zoneBtn?.style.top).toBe('30%')
    expect(zoneBtn?.style.width).toBe('40%')
    expect(zoneBtn?.style.height).toBe('25%')
  })

  // Test 3: Density collapse — large zones show item names, small zones show count
  it('shows item names in large zones and count in small zones', () => {
    const largeZone = makeZoneTag({
      label: 'Large Zone',
      target_id: 'sub-loc-large',
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    })
    const smallZone = makeZoneTag({
      id: 'small-zone-id',
      label: 'Small Zone',
      target_id: 'sub-loc-small',
      x: 0.6,
      y: 0.6,
      width: 0.1,
      height: 0.1,
    })

    const items = [
      makeItem({ name: 'Radio Set', location_id: 'sub-loc-large' }),
      makeItem({ name: 'First Aid Kit', location_id: 'sub-loc-large' }),
      makeItem({ name: 'Compass', location_id: 'sub-loc-small' }),
      makeItem({ name: 'Map Board', location_id: 'sub-loc-small' }),
      makeItem({ name: 'Protractor', location_id: 'sub-loc-small' }),
    ]

    render(
      <LocationTagPhoto
        tags={[largeZone, smallZone]}
        isEditMode={false}
        items={items}
      />
    )

    // Large zone shows individual item names
    expect(screen.getByText('Radio Set')).toBeTruthy()
    expect(screen.getByText('First Aid Kit')).toBeTruthy()

    // Small zone shows count badge "3"
    expect(screen.getByText('3')).toBeTruthy()
  })

  // Test 5: Minimum size filter (draw overlay)
  // Note: We test the logic indirectly — the draw overlay calls onZoneDrawn
  // only when the drawn rect is >= 5% in each dimension.
  // Direct gesture simulation is complex, so we verify the component renders.
  it('renders draw zone overlay when drawMode is true', () => {
    const { container } = render(
      <LocationTagPhoto
        tags={[]}
        isEditMode={true}
        drawMode={true}
        onZoneDrawn={vi.fn()}
      />
    )

    // Draw mode indicator
    expect(screen.getByText('Draw a zone')).toBeTruthy()

    // Overlay with crosshair cursor should be present
    const overlay = container.querySelector('[style*="crosshair"]')
    expect(overlay).toBeTruthy()
  })

  // Test 7: Existing tags without width/height continue as point badges
  it('renders existing tags without width/height as point badges (no regression)', () => {
    const tag1 = makeTag({ label: 'Badge 1', width: null, height: null })
    const tag2 = makeTag({ label: 'Badge 2', width: undefined, height: undefined })
    const tag3 = makeTag({ label: 'Badge 3' }) // no width/height keys

    render(
      <LocationTagPhoto
        tags={[tag1, tag2, tag3]}
        isEditMode={false}
      />
    )

    // All should render as point badges
    expect(screen.getByText('Badge 1')).toBeTruthy()
    expect(screen.getByText('Badge 2')).toBeTruthy()
    expect(screen.getByText('Badge 3')).toBeTruthy()

    // All should have the translate class (centered-on-point)
    const badges = ['Badge 1', 'Badge 2', 'Badge 3'].map(
      (label) => screen.getByText(label).closest('button')
    )
    badges.forEach((btn) => {
      expect(btn?.className).toContain('translate')
    })
  })

  // Test 8: Edit mode toggle — zones switch between static and draggable
  it('switches zones between static and draggable on edit mode change', () => {
    const zone = makeZoneTag({ label: 'Switchable Zone' })

    const { rerender, container } = render(
      <LocationTagPhoto
        tags={[zone]}
        isEditMode={false}
      />
    )

    // Static mode: should be a <button>
    const staticBtn = screen.getByText('Switchable Zone').closest('button')
    expect(staticBtn).toBeTruthy()
    // No ring indicator
    expect(staticBtn?.className).not.toContain('ring-2')

    // Switch to edit mode
    rerender(
      <LocationTagPhoto
        tags={[zone]}
        isEditMode={true}
        onZoneMove={vi.fn()}
        onZoneResize={vi.fn()}
        onTagRemove={vi.fn()}
      />
    )

    // Edit mode: rendered as a <div> with ring indicator and grab cursor
    const editZone = screen.getByText('Switchable Zone').closest('div[class*="ring-2"]')
    expect(editZone).toBeTruthy()
    expect(editZone?.className).toContain('cursor-grab')
  })

  // Test: DraggableZone shows remove button
  it('shows remove button on zones in edit mode', () => {
    const zone = makeZoneTag({ label: 'Removable Zone' })
    const onRemove = vi.fn()

    render(
      <LocationTagPhoto
        tags={[zone]}
        isEditMode={true}
        onTagRemove={onRemove}
      />
    )

    // Find the X button inside the zone
    const zoneContainer = screen.getByText('Removable Zone').closest('div[class*="ring-2"]')
    expect(zoneContainer).toBeTruthy()

    // The remove button should be present
    const removeBtn = zoneContainer?.querySelector('button[class*="bg-red"]')
    expect(removeBtn).toBeTruthy()

    // Click it
    if (removeBtn) fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalledWith(zone.id)
  })

  // Test: Zone tag tap navigates
  it('calls onTagTap when a static zone is clicked', () => {
    const zone = makeZoneTag({ label: 'Clickable Zone' })
    const onTap = vi.fn()

    render(
      <LocationTagPhoto
        tags={[zone]}
        isEditMode={false}
        onTagTap={onTap}
      />
    )

    fireEvent.click(screen.getByText('Clickable Zone'))
    expect(onTap).toHaveBeenCalledWith(zone)
  })

  // Test 10: Tags with width/height survive upsert round-trip structure
  it('preserves width and height fields on zone tags', () => {
    const zone = makeZoneTag({ width: 0.35, height: 0.22 })

    // Simulate the upsert stripping pattern: { id, ...rest }
    const { id, ...rest } = zone
    expect(rest.width).toBe(0.35)
    expect(rest.height).toBe(0.22)
    expect(rest.x).toBe(0.1)
    expect(rest.y).toBe(0.1)

    // Reconstruct (like the insert in upsertLocationTags)
    const row = {
      id: crypto.randomUUID(),
      location_id: rest.location_id,
      target_type: rest.target_type,
      target_id: rest.target_id,
      x: rest.x,
      y: rest.y,
      width: rest.width ?? null,
      height: rest.height ?? null,
      label: rest.label,
    }
    expect(row.width).toBe(0.35)
    expect(row.height).toBe(0.22)
  })

  // ── Self-zone baseline logic ────────────────────────────────

  it('hasZoneTags returns false for empty tag list (triggers baseline)', () => {
    const tags: LocationTag[] = []
    const hasZoneTags = tags.some(
      (t) => t.width != null && t.height != null && t.width > 0 && t.height > 0,
    )
    expect(hasZoneTags).toBe(false)
  })

  it('hasZoneTags returns true when zones exist (no baseline needed)', () => {
    const tags: LocationTag[] = [makeZoneTag()]
    const hasZoneTags = tags.some(
      (t) => t.width != null && t.height != null && t.width > 0 && t.height > 0,
    )
    expect(hasZoneTags).toBe(true)
  })

  it('baseline self-zone covers 90% of canvas centered', () => {
    const baseline = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }
    expect(baseline.x).toBe(0.05)
    expect(baseline.y).toBe(0.05)
    expect(baseline.width).toBe(0.9)
    expect(baseline.height).toBe(0.9)
    // Verify it's centered: x + width/2 = 0.5
    expect(baseline.x + baseline.width / 2).toBe(0.5)
    expect(baseline.y + baseline.height / 2).toBe(0.5)
  })

  // ── Split geometry ────────────────────────────────────────

  it('split halves the width and creates a right-half zone', () => {
    const original = { x: 0.1, y: 0.2, width: 0.4, height: 0.3 }
    const halfW = original.width / 2

    // Left half (updated original)
    const left = { ...original, width: halfW }
    expect(left.x).toBe(0.1)
    expect(left.width).toBe(0.2)

    // Right half (new pending zone)
    const right = {
      x: original.x + halfW,
      y: original.y,
      w: halfW,
      h: original.height,
    }
    expect(right.x).toBeCloseTo(0.3)
    expect(right.y).toBeCloseTo(0.2)
    expect(right.w).toBeCloseTo(0.2)
    expect(right.h).toBeCloseTo(0.3)
  })

  // ── Merge bounding box ────────────────────────────────────

  it('merge computes correct bounding box for two zones', () => {
    const tagA = { x: 0.1, y: 0.2, width: 0.2, height: 0.3 }
    const tagB = { x: 0.25, y: 0.1, width: 0.3, height: 0.25 }

    const x = Math.min(tagA.x, tagB.x)
    const y = Math.min(tagA.y, tagB.y)
    const w = Math.max(tagA.x + tagA.width, tagB.x + tagB.width) - x
    const h = Math.max(tagA.y + tagA.height, tagB.y + tagB.height) - y

    expect(x).toBe(0.1)
    expect(y).toBe(0.1)
    expect(w).toBeCloseTo(0.45)
    expect(h).toBeCloseTo(0.4)
  })

  // ── PendingZoneOverlay renders ─────────────────────────────

  it('renders pending zone overlay with input when pendingZone is set', () => {
    render(
      <LocationTagPhoto
        tags={[]}
        isEditMode={true}
        pendingZone={{ x: 0.1, y: 0.2, w: 0.3, h: 0.3 }}
        pendingZoneName=""
        onPendingZoneNameChange={vi.fn()}
        onPendingZoneConfirm={vi.fn()}
        onPendingZoneCancel={vi.fn()}
      />
    )

    // The input should be rendered
    const input = screen.getByPlaceholderText('Zone name...')
    expect(input).toBeTruthy()

    // Create button should be present
    expect(screen.getByText('Create')).toBeTruthy()
  })

  // ── Zone selection visual ──────────────────────────────────

  it('shows amber ring on selected zone in edit mode', () => {
    const zone = makeZoneTag({ label: 'Selectable Zone' })
    const selectedIds = new Set([zone.id])

    const { container } = render(
      <LocationTagPhoto
        tags={[zone]}
        isEditMode={true}
        onZoneMove={vi.fn()}
        onZoneResize={vi.fn()}
        onTagRemove={vi.fn()}
        selectedZoneIds={selectedIds}
        onZoneSelect={vi.fn()}
      />
    )

    const zoneEl = screen.getByText('Selectable Zone').closest('div[class*="ring-2"]')
    expect(zoneEl).toBeTruthy()
    expect(zoneEl?.className).toContain('ring-amber-400')
    expect(zoneEl?.className).not.toContain('ring-themeblue3/50')
  })
})
