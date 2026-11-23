/** Medic→outside attachment pointer, carried inside the sealed message text. */
export interface OutsideAttachment {
  kind: 'image' | 'file'
  path: string
  key: string
  mime: string
  name: string
  size: number
}

const TAG = 'oea1'
const PATH_RE = /^m\/[0-9a-f]{32}$/
const MIME_RE = /^[a-z0-9.+-]{1,64}\/[a-z0-9.+-]{1,128}$/i

export function encodeOutsideAttachment(a: OutsideAttachment): string {
  return JSON.stringify({ [TAG]: a })
}

export function decodeOutsideAttachment(text: string): OutsideAttachment | null {
  if (!text.startsWith(`{"${TAG}":`)) return null
  try {
    const a = (JSON.parse(text) as Record<string, unknown>)[TAG] as Partial<OutsideAttachment> | undefined
    if (!a || (a.kind !== 'image' && a.kind !== 'file')) return null
    if (typeof a.path !== 'string' || !PATH_RE.test(a.path)) return null
    if (typeof a.key !== 'string' || a.key.length === 0 || a.key.length > 64) return null
    const mime = typeof a.mime === 'string' && MIME_RE.test(a.mime) ? a.mime : 'application/octet-stream'
    const name = typeof a.name === 'string' ? a.name.slice(0, 200) : (a.kind === 'image' ? 'Photo' : 'File')
    const size = typeof a.size === 'number' && Number.isFinite(a.size) && a.size >= 0 ? a.size : 0
    return { kind: a.kind, path: a.path, key: a.key, mime, name, size }
  } catch {
    return null
  }
}
