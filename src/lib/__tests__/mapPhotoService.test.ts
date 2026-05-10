// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => new Map<string, unknown>())

vi.mock('../offlineDb', () => ({
  getDb: vi.fn().mockResolvedValue({
    put: vi.fn(async (_: string, value: { featureId: string }) => {
      store.set(value.featureId, value)
    }),
    get: vi.fn(async (_: string, key: string) => store.get(key)),
    delete: vi.fn(async (_: string, key: string) => { store.delete(key) }),
    transaction: vi.fn(() => ({
      store: { delete: vi.fn(async (key: string) => { store.delete(key) }) },
      done: Promise.resolve(),
    })),
  }),
}))

import { putPhoto, getPhoto, deletePhoto, deletePhotosForFeatures, hasPhoto } from '../mapPhotoService'

const PNG_BLOB = () => new Blob(['fake-png-bytes'], { type: 'image/png' })

describe('mapPhotoService', () => {
  beforeEach(() => store.clear())

  it('rejects non-image blobs', async () => {
    const r = await putPhoto('f1', new Blob(['plain'], { type: 'text/plain' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NOT_IMAGE')
  })

  it('rejects oversized images', async () => {
    const big = new Blob([new Uint8Array(9 * 1024 * 1024)], { type: 'image/jpeg' })
    const r = await putPhoto('f1', big)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('TOO_LARGE')
  })

  it('round-trips an image blob keyed by featureId', async () => {
    const r = await putPhoto('f1', PNG_BLOB(), 'src.png')
    expect(r.ok).toBe(true)
    const fetched = await getPhoto('f1')
    expect(fetched?.featureId).toBe('f1')
    expect(fetched?.sourceName).toBe('src.png')
    expect(fetched?.blob).toBeDefined()
  })

  it('hasPhoto reflects presence', async () => {
    expect(await hasPhoto('f1')).toBe(false)
    await putPhoto('f1', PNG_BLOB())
    expect(await hasPhoto('f1')).toBe(true)
  })

  it('deletePhoto is idempotent', async () => {
    await deletePhoto('never-existed')
    await putPhoto('f1', PNG_BLOB())
    await deletePhoto('f1')
    expect(await getPhoto('f1')).toBeNull()
    await deletePhoto('f1')
  })

  it('deletePhotosForFeatures purges all listed ids', async () => {
    await putPhoto('a', PNG_BLOB())
    await putPhoto('b', PNG_BLOB())
    await putPhoto('c', PNG_BLOB())
    await deletePhotosForFeatures(['a', 'b'])
    expect(await hasPhoto('a')).toBe(false)
    expect(await hasPhoto('b')).toBe(false)
    expect(await hasPhoto('c')).toBe(true)
  })

  it('deletePhotosForFeatures with empty list is a no-op', async () => {
    await putPhoto('keep', PNG_BLOB())
    await deletePhotosForFeatures([])
    expect(await hasPhoto('keep')).toBe(true)
  })
})
