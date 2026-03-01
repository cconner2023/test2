/**
 * Structured message content types and serialization.
 *
 * All messages (text and image) are serialized to a compact JSON string
 * before encryption. The receiver parses the JSON after decryption to
 * reconstruct the structured content.
 *
 * Wire format uses short keys to minimize ciphertext size:
 *   Text:  { t: "t", d: "hello" }
 *   Image: { t: "i", mime, key, path, w, h, thumb? }
 */

// ---- Content Types ----

/** Thread reply metadata — references the root message being replied to. */
export interface ReplyTo {
  messageId: string
  preview: string
}

export interface TextContent {
  type: 'text'
  text: string
  replyTo?: ReplyTo
}

export interface ImageContent {
  type: 'image'
  /** MIME type, e.g. "image/jpeg" */
  mime: string
  /** Base64-encoded AES-256-GCM key for decrypting the attachment blob. */
  key: string
  /** Storage path in the message-attachments bucket. */
  path: string
  /** Image width (after resize). */
  width: number
  /** Image height (after resize). */
  height: number
  /** Tiny base64 data-URL thumbnail for instant preview (optional). */
  thumbnail?: string
  replyTo?: ReplyTo
}

export type MessageContent = TextContent | ImageContent

// ---- Compact wire shapes ----

/** Compact wire shape for reply-to metadata. */
interface WireReplyTo {
  id: string
  p: string
}

interface WireText {
  t: 't'
  d: string
  rt?: WireReplyTo
}

interface WireImage {
  t: 'i'
  mime: string
  key: string
  path: string
  w: number
  h: number
  thumb?: string
  rt?: WireReplyTo
}

type WireContent = WireText | WireImage

// ---- Serialization ----

/** Build compact wire reply-to from structured ReplyTo. */
function toWireReplyTo(replyTo?: ReplyTo): WireReplyTo | undefined {
  if (!replyTo) return undefined
  return { id: replyTo.messageId, p: replyTo.preview }
}

/** Serialize structured content to a compact JSON string for encryption. */
export function serializeContent(content: MessageContent): string {
  if (content.type === 'text') {
    const wire: WireText = { t: 't', d: content.text }
    if (content.replyTo) wire.rt = toWireReplyTo(content.replyTo)
    return JSON.stringify(wire)
  }

  const wire: WireImage = {
    t: 'i',
    mime: content.mime,
    key: content.key,
    path: content.path,
    w: content.width,
    h: content.height,
  }
  if (content.thumbnail) wire.thumb = content.thumbnail
  if (content.replyTo) wire.rt = toWireReplyTo(content.replyTo)

  return JSON.stringify(wire)
}

// ---- Parsing ----

export interface ParsedContent {
  /** Display text for conversation list preview. */
  plaintext: string
  /** Structured content for rendering. */
  content: MessageContent
  /** Thread reply metadata (if this message is a reply). */
  replyTo?: ReplyTo
}

/**
 * Parse a decrypted plaintext string into structured content.
 *
 * Handles both the new JSON format and plain strings (for request messages
 * or any edge case where content isn't JSON-wrapped).
 */
export function parseMessageContent(raw: string): ParsedContent {
  // Try parsing as structured JSON
  try {
    const wire = JSON.parse(raw) as WireContent
    const replyTo = wire.rt ? { messageId: wire.rt.id, preview: wire.rt.p } : undefined

    if (wire.t === 't') {
      return {
        plaintext: wire.d,
        content: { type: 'text', text: wire.d, ...(replyTo && { replyTo }) },
        replyTo,
      }
    }

    if (wire.t === 'i') {
      return {
        plaintext: '\u{1F4F7} Photo',
        content: {
          type: 'image',
          mime: wire.mime,
          key: wire.key,
          path: wire.path,
          width: wire.w,
          height: wire.h,
          thumbnail: wire.thumb,
          ...(replyTo && { replyTo }),
        },
        replyTo,
      }
    }
  } catch {
    // Not JSON — treat as raw text
  }

  // Fallback: treat entire string as plain text
  return {
    plaintext: raw,
    content: { type: 'text', text: raw },
  }
}
