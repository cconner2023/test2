/**
 * Tests for mapOverlayService — read helpers only.
 *
 * Overlays are propagated via the clinic Signal vault now (see
 * useMapOverlayWrite / useMapOverlayVault) so saveOverlay / deleteOverlay
 * are no longer exposed by this module. The write/vault flow is covered by
 * its own hook tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LocalMapOverlay } from '../../../Types/MapOverlayTypes'

// ── Mock offlineDb ──────────────────────────────────────────
const mockGetLocalMapOverlays = vi.fn()
const mockGetLocalMapOverlay = vi.fn()

vi.mock('../../../lib/offlineDb', () => ({
  getLocalMapOverlays: (...args: unknown[]) => mockGetLocalMapOverlays(...args),
  getLocalMapOverlay: (...args: unknown[]) => mockGetLocalMapOverlay(...args),
}))

const { getOverlays, getOverlay } = await import('../../../lib/mapOverlayService')

function makeOverlay(id = 'test-1', clinicId = 'clinic-1'): LocalMapOverlay {
  return {
    id,
    clinic_id: clinicId,
    name: 'Test Overlay',
    center: [38.8977, -77.0365],
    zoom: 13,
    features: [],
    created_by: 'user-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    _sync_status: 'synced',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getOverlays', () => {
  it('returns ok with overlays from IDB', async () => {
    mockGetLocalMapOverlays.mockResolvedValue([makeOverlay('a'), makeOverlay('b')])
    const result = await getOverlays('clinic-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toHaveLength(2)
    expect(mockGetLocalMapOverlays).toHaveBeenCalledWith('clinic-1')
  })

  it('returns err when IDB throws', async () => {
    mockGetLocalMapOverlays.mockRejectedValue(new Error('IDB crash'))
    const result = await getOverlays('clinic-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Failed')
  })
})

describe('getOverlay', () => {
  it('returns ok with single overlay', async () => {
    mockGetLocalMapOverlay.mockResolvedValue(makeOverlay())
    const result = await getOverlay('test-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data?.id).toBe('test-1')
  })

  it('returns ok with undefined when not found', async () => {
    mockGetLocalMapOverlay.mockResolvedValue(undefined)
    const result = await getOverlay('missing')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBeUndefined()
  })
})
