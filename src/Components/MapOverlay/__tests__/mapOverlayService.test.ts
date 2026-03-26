/**
 * Tests for mapOverlayService — CRUD operations and Result wrapping.
 * Mocks offlineDb and syncService to isolate service logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LocalMapOverlay } from '../../../Types/MapOverlayTypes'

// ── Mock offlineDb ──────────────────────────────────────────
const mockGetLocalMapOverlays = vi.fn()
const mockGetLocalMapOverlay = vi.fn()
const mockSaveLocalMapOverlay = vi.fn()
const mockDeleteLocalMapOverlay = vi.fn()
const mockAddToSyncQueue = vi.fn()
const mockStripLocalFields = vi.fn((o: Record<string, unknown>) => o)

vi.mock('../../../lib/offlineDb', () => ({
  getLocalMapOverlays: (...args: unknown[]) => mockGetLocalMapOverlays(...args),
  getLocalMapOverlay: (...args: unknown[]) => mockGetLocalMapOverlay(...args),
  saveLocalMapOverlay: (...args: unknown[]) => mockSaveLocalMapOverlay(...args),
  deleteLocalMapOverlay: (...args: unknown[]) => mockDeleteLocalMapOverlay(...args),
  addToSyncQueue: (...args: unknown[]) => mockAddToSyncQueue(...args),
  stripLocalFields: (...args: unknown[]) => mockStripLocalFields(...args),
}))

vi.mock('../../../lib/syncService', () => ({
  processSyncQueue: vi.fn().mockResolvedValue(undefined),
  isOnline: vi.fn().mockReturnValue(false),
}))

// Import after mocks
const { getOverlays, getOverlay, saveOverlay, deleteOverlay } = await import('../../../lib/mapOverlayService')

// ── Fixtures ────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getOverlays', () => {
  it('returns ok with overlays from IDB', async () => {
    const overlays = [makeOverlay('a'), makeOverlay('b')]
    mockGetLocalMapOverlays.mockResolvedValue(overlays)

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

describe('saveOverlay', () => {
  it('creates new overlay and queues sync', async () => {
    mockGetLocalMapOverlay.mockResolvedValue(undefined)
    mockSaveLocalMapOverlay.mockResolvedValue(undefined)
    mockAddToSyncQueue.mockResolvedValue(undefined)

    const result = await saveOverlay({
      overlayId: 'new-1',
      clinicId: 'clinic-1',
      userId: 'user-1',
      name: 'New Overlay',
      center: [0, 0],
      zoom: 10,
      features: [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe('new-1')
      expect(result.data.name).toBe('New Overlay')
      expect(result.data._sync_status).toBe('pending')
    }

    expect(mockSaveLocalMapOverlay).toHaveBeenCalledOnce()
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', table_name: 'map_overlays' })
    )
  })

  it('updates existing overlay with action "update"', async () => {
    mockGetLocalMapOverlay.mockResolvedValue(makeOverlay())
    mockSaveLocalMapOverlay.mockResolvedValue(undefined)
    mockAddToSyncQueue.mockResolvedValue(undefined)

    await saveOverlay({
      overlayId: 'test-1',
      clinicId: 'clinic-1',
      userId: 'user-1',
      name: 'Updated',
      center: [0, 0],
      zoom: 10,
      features: [],
    })

    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update' })
    )
  })

  it('returns err when IDB save fails', async () => {
    mockGetLocalMapOverlay.mockResolvedValue(undefined)
    mockSaveLocalMapOverlay.mockRejectedValue(new Error('quota exceeded'))

    const result = await saveOverlay({
      overlayId: 'fail',
      clinicId: 'clinic-1',
      userId: 'user-1',
      name: 'Fail',
      center: [0, 0],
      zoom: 10,
      features: [],
    })

    expect(result.ok).toBe(false)
  })
})

describe('deleteOverlay', () => {
  it('deletes from IDB and queues sync', async () => {
    mockDeleteLocalMapOverlay.mockResolvedValue(undefined)
    mockAddToSyncQueue.mockResolvedValue(undefined)

    const result = await deleteOverlay('test-1', 'user-1')
    expect(result.ok).toBe(true)
    expect(mockDeleteLocalMapOverlay).toHaveBeenCalledWith('test-1')
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', record_id: 'test-1' })
    )
  })

  it('returns err when delete fails', async () => {
    mockDeleteLocalMapOverlay.mockRejectedValue(new Error('not found'))

    const result = await deleteOverlay('missing', 'user-1')
    expect(result.ok).toBe(false)
  })
})
