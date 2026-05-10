/**
 * MBTiles import — main-thread orchestrator.
 *
 * Drives src/workers/mbtilesImport.worker.ts: spawns the worker, posts the
 * file's ArrayBuffer, receives streamed tile messages, writes each blob to
 * the importedBasemapTiles IDB store, persists meta on completion, and
 * registers a TileSource so the user can immediately switch the basemap.
 *
 * Cancellable: the returned controller supports abort() which terminates
 * the worker and rolls back partial state.
 */

import { getDb, type ImportedBasemapMeta } from '../offlineDb'
import { mimeForFormat, type MbtilesWorkerMessage, type MBTilesMeta } from './mbtilesShared'
import { registerTileSource, type TileSource } from '../mapTileService'

export interface MBTilesImportProgress {
  phase: 'parsing' | 'streaming' | 'done' | 'error'
  meta?: MBTilesMeta
  done: number
  total: number
  sizeBytes: number
  error?: string
}

export interface MBTilesImportController {
  promise: Promise<ImportedBasemapMeta | null>
  abort: () => void
}

export function importMBTiles(
  file: File,
  onProgress: (p: MBTilesImportProgress) => void,
): MBTilesImportController {
  const sourceId = `mbtiles:${crypto.randomUUID()}`
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

    // Worker construction — Vite resolves the URL at build time so this
    // bundles correctly under both dev and production PWA builds.
    worker = new Worker(new URL('../../workers/mbtilesImport.worker.ts', import.meta.url), {
      type: 'module',
    })

    let meta: MBTilesMeta | null = null
    let total = 0
    let done = 0
    let bytes = 0
    let mime = 'image/png'

    onProgress({ phase: 'parsing', done: 0, total: 0, sizeBytes: 0 })

    return await new Promise<ImportedBasemapMeta | null>((resolve, reject) => {
      const cleanup = () => { worker?.terminate(); worker = null }

      const rollback = async () => {
        // Best-effort purge of partially-written tiles.
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

      worker!.onmessage = async (e: MessageEvent<MbtilesWorkerMessage>) => {
        if (aborted) return
        const msg = e.data
        switch (msg.kind) {
          case 'meta': {
            meta = msg.meta
            total = msg.tileCount
            mime = mimeForFormat(meta.format)
            onProgress({ phase: 'streaming', meta, done: 0, total, sizeBytes: 0 })
            break
          }
          case 'tile': {
            const blob = new Blob([msg.data], { type: mime })
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
                phase: 'error',
                done, total, sizeBytes: bytes,
                error: err instanceof Error ? err.message : 'IDB write failed',
              })
              resolve(null)
            }
            break
          }
          case 'progress': {
            done = msg.done
            onProgress({ phase: 'streaming', meta: meta ?? undefined, done, total, sizeBytes: bytes })
            break
          }
          case 'done': {
            cleanup()
            if (!meta) {
              onProgress({ phase: 'error', done, total, sizeBytes: bytes, error: 'No metadata in file' })
              resolve(null)
              return
            }
            const persisted: ImportedBasemapMeta = {
              sourceId,
              name: meta.name,
              format: 'mbtiles',
              tileMime: mime,
              bounds: meta.bounds,
              center: meta.center,
              minZoom: meta.minzoom ?? 0,
              maxZoom: meta.maxzoom ?? 19,
              tileCount: total,
              sizeBytes: msg.sizeBytes,
              importedAt: new Date().toISOString(),
              attribution: meta.attribution,
            }
            try { await db.put('importedBasemapMeta', persisted) }
            catch {
              await rollback()
              onProgress({ phase: 'error', done, total, sizeBytes: bytes, error: 'Could not persist metadata' })
              resolve(null)
              return
            }
            registerTileSource(buildImportedSource(persisted))
            onProgress({ phase: 'done', meta, done: total, total, sizeBytes: msg.sizeBytes })
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

      worker!.postMessage({ file: arrayBuf }, [arrayBuf])
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

/**
 * Construct a TileSource for an imported basemap. The url() is a placeholder
 * (renderer prefers getBlob), but kept truthy so any code path that accesses
 * it doesn't throw.
 */
export function buildImportedSource(meta: ImportedBasemapMeta): TileSource {
  return {
    id: meta.sourceId,
    name: meta.name,
    url: () => '',
    getBlob: async (z, x, y) => {
      try {
        const db = await getDb()
        const entry = await db.get('importedBasemapTiles', `${meta.sourceId}/${z}/${x}/${y}`)
        return entry?.blob ?? null
      } catch { return null }
    },
    attribution: meta.attribution ?? `Imported · ${meta.name}`,
    minZoom: meta.minZoom,
    maxZoom: meta.maxZoom,
    cacheZoomMin: meta.minZoom,
    cacheZoomMax: meta.maxZoom,
    // Imported basemaps already live in IDB — bulk-cache flow is a no-op.
    policy: { allowBulkCache: false },
    category: meta.format === 'mbtiles' ? 'imagery' : 'topo',
    description: meta.format === 'mbtiles' ? 'Imported MBTiles map' : 'Imported map',
    imported: true,
  }
}

/** Read-only metadata access for UI lists + boot-time registration. */
export async function listImportedBasemaps(): Promise<ImportedBasemapMeta[]> {
  try {
    const db = await getDb()
    return await db.getAll('importedBasemapMeta')
  } catch { return [] }
}

/** Register every persisted imported basemap. Called once on map open so
 *  the user finds their imported sources in the basemap selector. */
export async function registerAllImportedBasemaps(): Promise<void> {
  for (const meta of await listImportedBasemaps()) {
    registerTileSource(buildImportedSource(meta))
  }
}

/** Remove an imported basemap entirely — its meta and every tile blob.
 *  The TileSource lingers in TILE_SOURCES until next reload (low cost). */
export async function deleteImportedBasemap(sourceId: string): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(['importedBasemapMeta', 'importedBasemapTiles'], 'readwrite')
    await tx.objectStore('importedBasemapMeta').delete(sourceId)
    const tilesStore = tx.objectStore('importedBasemapTiles')
    let cur = await tilesStore.openCursor()
    while (cur) {
      if ((cur.key as string).startsWith(`${sourceId}/`)) await cur.delete()
      cur = await cur.continue()
    }
    await tx.done
  } catch { /* idempotent */ }
}
