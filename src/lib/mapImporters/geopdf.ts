/**
 * Geo-PDF import — main-thread orchestrator (Phase 3.2a).
 * Mirrors mbtiles.ts: spawns the worker, posts file + bounds + options,
 * receives streamed tiles, persists tiles + meta to IDB, registers a
 * TileSource. v1 takes manual bounds; LGI auto-detection is 3.2b.
 */

import { getDb, type ImportedBasemapMeta } from '../offlineDb'
import type { GeoPdfImportOptions, GeoPdfWorkerMessage } from './geopdfShared'
import { registerTileSource } from '../mapTileService'
import { buildImportedSource } from './mbtiles'

export interface GeoPdfImportProgress {
  phase: 'parsing' | 'streaming' | 'done' | 'error'
  done: number
  total: number
  sizeBytes: number
  error?: string
}

export interface GeoPdfImportController {
  promise: Promise<ImportedBasemapMeta | null>
  abort: () => void
}

export function importGeoPdf(
  file: File,
  options: GeoPdfImportOptions,
  onProgress: (p: GeoPdfImportProgress) => void,
): GeoPdfImportController {
  const sourceId = `geopdf:${crypto.randomUUID()}`
  let aborted = false
  let worker: Worker | null = null

  const promise = (async (): Promise<ImportedBasemapMeta | null> => {
    let arrayBuf: ArrayBuffer
    try { arrayBuf = await file.arrayBuffer() }
    catch {
      onProgress({ phase: 'error', done: 0, total: 0, sizeBytes: 0, error: 'Could not read file' })
      return null
    }
    if (aborted) return null

    const db = await getDb()

    worker = new Worker(new URL('../../workers/geopdfImport.worker.ts', import.meta.url), {
      type: 'module',
    })

    let total = 0
    let done = 0
    let bytes = 0
    let minZoom = 0
    let maxZoom = 0

    onProgress({ phase: 'parsing', done: 0, total: 0, sizeBytes: 0 })

    return await new Promise<ImportedBasemapMeta | null>((resolve) => {
      const cleanup = () => { worker?.terminate(); worker = null }

      const rollback = async () => {
        try {
          const tx = db.transaction('importedBasemapTiles', 'readwrite')
          let cur = await tx.store.openCursor()
          while (cur) {
            if ((cur.key as string).startsWith(`${sourceId}/`)) await cur.delete()
            cur = await cur.continue()
          }
          await tx.done
        } catch { /* swallow */ }
      }

      worker!.onerror = async (e) => {
        cleanup()
        await rollback()
        onProgress({ phase: 'error', done, total, sizeBytes: bytes, error: e.message })
        resolve(null)
      }

      worker!.onmessage = async (e: MessageEvent<GeoPdfWorkerMessage>) => {
        if (aborted) return
        const msg = e.data
        switch (msg.kind) {
          case 'meta': {
            total = msg.tileCount
            minZoom = msg.minZoom
            maxZoom = msg.maxZoom
            onProgress({ phase: 'streaming', done: 0, total, sizeBytes: 0 })
            break
          }
          case 'tile': {
            const blob = new Blob([msg.data], { type: 'image/png' })
            bytes += blob.size
            try {
              await db.put('importedBasemapTiles', {
                key: `${sourceId}/${msg.z}/${msg.x}/${msg.y}`,
                blob,
              })
            } catch (err) {
              cleanup()
              await rollback()
              onProgress({
                phase: 'error', done, total, sizeBytes: bytes,
                error: err instanceof Error ? err.message : 'IDB write failed',
              })
              resolve(null)
            }
            break
          }
          case 'progress': {
            done = msg.done
            onProgress({ phase: 'streaming', done, total, sizeBytes: bytes })
            break
          }
          case 'done': {
            cleanup()
            const persisted: ImportedBasemapMeta = {
              sourceId,
              name: file.name.replace(/\.[^/.]+$/, ''),
              format: 'geopdf',
              tileMime: 'image/png',
              bounds: options.bounds,
              center: [
                (options.bounds[1] + options.bounds[3]) / 2,
                (options.bounds[0] + options.bounds[2]) / 2,
              ],
              minZoom,
              maxZoom,
              tileCount: total,
              sizeBytes: msg.sizeBytes,
              importedAt: new Date().toISOString(),
              attribution: `Imported geo-PDF · ${file.name}`,
            }
            try { await db.put('importedBasemapMeta', persisted) }
            catch {
              await rollback()
              onProgress({ phase: 'error', done, total, sizeBytes: bytes, error: 'Could not persist metadata' })
              resolve(null)
              return
            }
            registerTileSource(buildImportedSource(persisted))
            onProgress({ phase: 'done', done: total, total, sizeBytes: msg.sizeBytes })
            resolve(persisted)
            break
          }
          case 'error': {
            cleanup()
            await rollback()
            onProgress({ phase: 'error', done, total, sizeBytes: bytes, error: msg.message })
            resolve(null)
            break
          }
        }
      }

      worker!.postMessage({ file: arrayBuf, options }, [arrayBuf])
    })
  })()

  return {
    promise,
    abort: () => {
      aborted = true
      if (worker) { worker.terminate(); worker = null }
    },
  }
}
