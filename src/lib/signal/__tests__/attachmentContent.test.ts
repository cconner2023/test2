import { describe, it, expect } from 'vitest'
import { serializeContent, parseMessageContent } from '../messageContent'
import type { FileContent, ImageContent, VoiceContent, SharedBundleContent } from '../messageContent'

describe('attachment wire format', () => {
  it('round-trips a file message', () => {
    const file: FileContent = {
      type: 'file', store: 'r2', path: 'm/0123456789abcdef0123456789abcdef', key: 'a2V5',
      mime: 'application/pdf', name: 'DA 5988E.pdf', size: 123_456,
    }
    const parsed = parseMessageContent(serializeContent(file))
    expect(parsed.content).toEqual(file)
    expect(parsed.plaintext).toBe('File: DA 5988E.pdf')
  })

  it('carries store on image, voice and bundle refs', () => {
    const image: ImageContent = { type: 'image', mime: 'image/jpeg', key: 'k', path: 'm/x', store: 'r2', width: 10, height: 20 }
    const voice: VoiceContent = { type: 'voice', mime: 'audio/webm', key: 'k', path: 'm/y', store: 'r2', duration: 3, waveform: [0.1] }
    const bundle: SharedBundleContent = {
      type: 'shared_bundle', bundleKind: 'map-overlay', path: 'm/z', key: 'k', store: 'r2',
      contentHash: 'h', label: 'Route', sourceCluster: 'BAS',
    }
    for (const c of [image, voice, bundle]) {
      expect((parseMessageContent(serializeContent(c)).content as { store?: string }).store).toBe('r2')
    }
  })

  it('leaves legacy refs without store', () => {
    const legacy: ImageContent = { type: 'image', mime: 'image/jpeg', key: 'k', path: 'uid/uuid.enc', width: 1, height: 1 }
    const parsed = parseMessageContent(serializeContent(legacy)).content as ImageContent
    expect(parsed.store).toBeUndefined()
  })

  it('an unknown wire type falls back to text instead of throwing (old-client behaviour)', () => {
    const parsed = parseMessageContent(JSON.stringify({ t: 'zz', p: 'x' }))
    expect(parsed.content.type).toBe('text')
  })
})
