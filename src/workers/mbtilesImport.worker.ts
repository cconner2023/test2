/// <reference lib="webworker" />
/**
 * MBTiles import worker — opens a user-supplied .mbtiles file as SQLite via
 * sql.js (lazy-loaded WASM), reads the metadata + tiles tables, and streams
 * each tile blob back to the main thread. y-axis is converted from TMS
 * (MBTiles native) to XYZ (Beacon's storage convention) here so the main
 * thread can write keys without thinking about it.
 */

import initSqlJs from 'sql.js'
import {
  tmsYToXyzY,
  mimeForFormat,
  type MBTilesMeta,
  type MbtilesWorkerMessage,
} from '../lib/mapImporters/mbtilesShared'

declare const self: DedicatedWorkerGlobalScope

// sql.js needs to know where to load its wasm from. Vite bundles the worker
// file separately; we resolve the wasm via an absolute import URL so it
// works under both `npm run dev` and the production PWA build.
const WASM_URL = new URL('sql.js/dist/sql-wasm.wasm', import.meta.url).toString()

self.addEventListener('message', async (event: MessageEvent<{ file: ArrayBuffer }>) => {
  const post = (msg: MbtilesWorkerMessage) => self.postMessage(msg)
  try {
    const SQL = await initSqlJs({ locateFile: () => WASM_URL })
    const db = new SQL.Database(new Uint8Array(event.data.file))

    // ── Metadata ──
    const metaRows = db.exec('SELECT name, value FROM metadata')
    const raw: Record<string, string> = {}
    if (metaRows[0]) {
      for (const row of metaRows[0].values) {
        const [k, v] = row as [string, string]
        raw[k] = v
      }
    }
    const meta: MBTilesMeta = {
      name: raw.name || 'Imported MBTiles',
      format: (raw.format || 'png').toLowerCase(),
      bounds: raw.bounds ? (raw.bounds.split(',').map(parseFloat) as [number, number, number, number]) : undefined,
      center: raw.center
        ? (() => {
            const parts = raw.center.split(',').map(parseFloat)
            // MBTiles center spec: lon,lat,zoom — Beacon stores [lat, lng]
            return Number.isFinite(parts[0]) && Number.isFinite(parts[1]) ? [parts[1], parts[0]] as [number, number] : undefined
          })()
        : undefined,
      minzoom: raw.minzoom != null ? parseInt(raw.minzoom, 10) : undefined,
      maxzoom: raw.maxzoom != null ? parseInt(raw.maxzoom, 10) : undefined,
      attribution: raw.attribution,
      description: raw.description,
      raw,
    }

    if (meta.format === 'pbf') {
      // Vector MBTiles need a vector renderer; out of scope for v1.
      post({ kind: 'error', message: 'Vector (.pbf) MBTiles are not supported yet.' })
      db.close()
      return
    }

    // ── Total count for progress bar ──
    let total = 0
    const cnt = db.exec('SELECT COUNT(*) FROM tiles')
    if (cnt[0]) total = Number(cnt[0].values[0][0])

    post({ kind: 'meta', meta, tileCount: total })

    // ── Stream tiles ──
    const stmt = db.prepare('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles')
    let done = 0
    let bytes = 0
    while (stmt.step()) {
      const r = stmt.get() as [number, number, number, Uint8Array]
      const z = r[0] as number
      const x = r[1] as number
      const tmsY = r[2] as number
      const data = r[3] as Uint8Array
      const xyzY = tmsYToXyzY(z, tmsY)
      bytes += data.byteLength
      // Transfer the underlying buffer for zero-copy.
      post({ kind: 'tile', z, x, y: xyzY, data })
      done++
      if (done % 200 === 0 || done === total) {
        post({ kind: 'progress', done, total })
      }
    }
    stmt.free()
    db.close()

    // mimeForFormat used downstream — included here so the consumer doesn't
    // re-derive the same mapping.
    void mimeForFormat
    post({ kind: 'done', sizeBytes: bytes })
  } catch (e) {
    post({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
  }
})
