/**
 * Structured message content types and serialization.
 *
 * All messages (text and image) are serialized to a compact JSON string
 * before encryption. The receiver parses the JSON after decryption to
 * reconstruct the structured content.
 *
 * Wire format uses short keys to minimize ciphertext size:
 *   Text:           { t: "t", d: "hello" }
 *   Image:          { t: "i", mime, key, path, w, h, thumb? }
 *   Voice:          { t: "v", mime, key, path, dur, wf }
 *   Calendar event: { t: "e", a: "c"|"u"|"d", d: {...} }
 *   Map overlay:    { t: "o", a: "c"|"u"|"d", d: {...} }   ← overlay metadata + (legacy) full feature set
 *   Map feature:    { t: "mf", a: "c"|"u"|"d", o, c?, f }  ← single feature within a parent overlay
 *   Shared ref:     { t: "r", k: "ce"|"mo", id, l, s?, f? } ← chat-visible deep link to a clustered object
 */

import type { EventCategory, EventStatus } from '../../Types/CalendarTypes'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'

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

export interface VoiceContent {
  type: 'voice'
  mime: string
  key: string
  path: string
  duration: number
  waveform: number[]
  replyTo?: ReplyTo
}

/**
 * Payload for a calendar event sync message.
 * For 'create': all fields should be populated.
 * For 'update': id + only changed fields.
 * For 'delete': id only.
 */
export interface CalendarEventPayload {
  id: string
  title?: string
  description?: string | null
  category?: EventCategory
  status?: EventStatus
  start_time?: string
  end_time?: string
  all_day?: boolean
  location?: string | null
  opord_notes?: string | null
  uniform?: string | null
  report_time?: string | null
  assigned_to?: string[]
  property_item_ids?: string[]
  created_by?: string
  clinic_id?: string
  created_at?: string
  updated_at?: string
  /** Origin ID for tracking the broadcast message on the server. */
  originId?: string
}

export interface CalendarEventContent {
  type: 'calendar_event'
  action: 'create' | 'update' | 'delete'
  data: CalendarEventPayload
}

/**
 * Payload for a map overlay sync message.
 * For 'create': all fields should be populated.
 * For 'update': id + only changed fields.
 * For 'delete': id only.
 */
export interface MapOverlayPayload {
  id: string
  clinic_id?: string
  name?: string
  description?: string
  center?: [number, number]
  zoom?: number
  features?: OverlayFeature[]
  created_by?: string
  created_at?: string
  updated_at?: string
  /** Origin ID for tracking the broadcast message on the server. */
  originId?: string
}

export interface MapOverlayContent {
  type: 'map_overlay'
  action: 'create' | 'update' | 'delete'
  data: MapOverlayPayload
}

/**
 * Payload for a single map overlay feature sync message — the per-feature
 * sibling of MapOverlayPayload. Edits dispatch one of these per touched
 * feature instead of re-sending the whole overlay's features[] each time.
 *
 * For 'create' / 'update': feature is the full OverlayFeature.
 * For 'delete':            feature carries only { id }.
 */
export interface MapFeaturePayload {
  /** Parent overlay id — receivers locate the overlay to mutate. */
  overlay_id: string
  /** Owning clinic id — drives the vault fan-out target. */
  clinic_id?: string
  /** Full feature on c/u; { id } on d. */
  feature: OverlayFeature | { id: string }
  /** Origin ID for tracking the broadcast message on the server. */
  originId?: string
}

export interface MapFeatureContent {
  type: 'map_feature'
  action: 'create' | 'update' | 'delete'
  data: MapFeaturePayload
}

/**
 * Outside event-intake REQUEST content. Anon-authored, plaintext jsonb on
 * the wire (submit_event_intake builds the payload literal directly; the
 * SealedEnvelope crypto path is bypassed via decryptRow / drainSystemInbox
 * early-exits). This variant is constructed ONLY inside those early-exits;
 * it never reaches `serializeContent` and has no compact wire shape.
 */
export interface IntakeRequestContent {
  type: 'intake_request'
  intake_id: string
  requester_name: string
  requester_org?: string
  requester_email: string
  /** ISO timestamp string. */
  requested_start: string
  /** ISO timestamp string. */
  requested_end: string
  title: string
}

/** Voicemail payload carried inline in a resolved oncall-call card. The audio is
 *  AES-256-GCM ciphertext (base64, IV-prepended); the AES key is sealed to the
 *  clinic voicemail pubkey (see src/lib/oncallSeal.ts). Server stores ciphertext
 *  only — the no-PHI-on-wire invariant holds (operational audio, E2E-encrypted). */
export interface OncallVoicemailData {
  /** base64(IV ‖ AES-GCM audio ciphertext). */
  audio: string
  mime: string
  duration: number
  waveform: number[]
  /** base64(IV ‖ AES-GCM) of the audio key, wrapped to the clinic voicemail key. */
  sealed_key: string
  /** base64 raw ephemeral P-256 pubkey used for the seal. */
  ephemeral_pub: string
  /** base64 HKDF salt. */
  nonce: string
}

/**
 * Resolved outside→on-call CALL card — the durable record of one on-call call,
 * SYSTEM-authored plaintext jsonb (like IntakeRequestContent). Decrypt-only:
 * constructed inside the decryptRow / drainSystemInbox oncall early-exits, never
 * serialized. The live ring (oncall-ring) is NOT a content type — it routes to
 * the call layer via the oncall signal bus and is never stored as a card.
 */
export interface OncallCallContent {
  type: 'oncall_call'
  call_id: string
  clinic_id: string
  requester_name: string
  outcome: 'connected_ended' | 'declined' | 'missed' | 'voicemail'
  /** ISO timestamp string. */
  ended_at: string
  voicemail?: OncallVoicemailData
}

/**
 * Chat-visible reference to an object that already lives in the clinic cluster
 * (a calendar event or a map overlay). Carries ONLY an opaque id + an
 * operator-supplied label — never the object's payload, never PHI. The
 * recipient resolves the LIVE object from their own vault-synced IndexedDB;
 * tapping the rendered card deep-links into the calendar / map drawer.
 *
 * Distinct from the e/o/mf SYNC envelopes (those fan out to the vault and never
 * render as a bubble). A shared_ref is authored into a 1:1 or group thread and
 * renders as a tappable card.
 */
export interface SharedRefContent {
  type: 'shared_ref'
  /** Which domain object this references. */
  refKind: 'calendar-event' | 'map-overlay' | 'property-item'
  /** Opaque id — calendar event id, overlay id, or property item id. Clinic-scoped. */
  refId: string
  /** Operator-supplied display label. Operational vocabulary ONLY — no PHI. */
  label: string
  /** Secondary line (date, waypoint count, etc.). Operational only. */
  subLabel?: string
  /** Optional sub-reference into an overlay (a specific feature/waypoint). */
  featureId?: string
}

/**
 * Outside→cluster ONE-WAY message card — an outside party (QR + passphrase) drops a
 * sealed text note to the whole clinic cluster. SYSTEM-authored; the body is SEALED to
 * the clinic inbound pubkey (oncall_recipient_pub) with the SAME envelope as voicemail
 * audio — never plaintext at rest. Decrypt-only (constructed in the decryptRow oncall
 * early-exit, never serialized). Decryption capability = cluster membership.
 */
export interface OutsideMessageContent {
  type: 'outside_message'
  message_id: string
  clinic_id: string
  requester_name: string
  sealed: {
    /** base64(IV ‖ AES-GCM ciphertext) of the UTF-8 message body. */
    ciphertext: string
    /** base64(IV ‖ AES-GCM) of the body key, sealed to the clinic inbound key. */
    sealed_key: string
    /** base64 raw ephemeral P-256 pubkey used for the seal. */
    ephemeral_pub: string
    /** base64 HKDF salt. */
    nonce: string
  }
}

export type MessageContent = TextContent | ImageContent | VoiceContent | CalendarEventContent | MapOverlayContent | MapFeatureContent | SharedRefContent | IntakeRequestContent | OncallCallContent | OutsideMessageContent

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

interface WireVoice {
  t: 'v'
  mime: string
  key: string
  path: string
  dur: number
  wf: number[]
  rt?: WireReplyTo
}

interface WireCalendarEvent {
  t: 'e'
  a: 'c' | 'u' | 'd'
  d: Record<string, unknown>
}

interface WireMapOverlay {
  t: 'o'
  a: 'c' | 'u' | 'd'
  d: Record<string, unknown>
}

interface WireMapFeature {
  t: 'mf'
  a: 'c' | 'u' | 'd'
  /** Parent overlay id. */
  o: string
  /** Clinic id (optional — present on c/u, omitted on d when caller didn't capture it). */
  c?: string
  /** Feature payload. Full feature on c/u; { id } on d. */
  f: Record<string, unknown>
}

interface WireSharedRef {
  t: 'r'
  /** kind: 'ce' calendar event | 'mo' map overlay | 'pi' property item */
  k: 'ce' | 'mo' | 'pi'
  id: string
  l: string
  s?: string
  f?: string
}

type WireContent = WireText | WireImage | WireVoice | WireCalendarEvent | WireMapOverlay | WireMapFeature | WireSharedRef

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

  if (content.type === 'image') {
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

  if (content.type === 'calendar_event') {
    const actionMap = { create: 'c', update: 'u', delete: 'd' } as const
    const wire: WireCalendarEvent = {
      t: 'e',
      a: actionMap[content.action],
      d: content.data as Record<string, unknown>,
    }
    return JSON.stringify(wire)
  }

  if (content.type === 'map_overlay') {
    const actionMap = { create: 'c', update: 'u', delete: 'd' } as const
    const wire: WireMapOverlay = {
      t: 'o',
      a: actionMap[content.action],
      d: content.data as Record<string, unknown>,
    }
    return JSON.stringify(wire)
  }

  if (content.type === 'map_feature') {
    const actionMap = { create: 'c', update: 'u', delete: 'd' } as const
    const wire: WireMapFeature = {
      t: 'mf',
      a: actionMap[content.action],
      o: content.data.overlay_id,
      f: content.data.feature as unknown as Record<string, unknown>,
    }
    if (content.data.clinic_id) wire.c = content.data.clinic_id
    return JSON.stringify(wire)
  }

  if (content.type === 'shared_ref') {
    const kindMap = { 'calendar-event': 'ce', 'map-overlay': 'mo', 'property-item': 'pi' } as const
    const wire: WireSharedRef = {
      t: 'r',
      k: kindMap[content.refKind],
      id: content.refId,
      l: content.label,
    }
    if (content.subLabel) wire.s = content.subLabel
    if (content.featureId) wire.f = content.featureId
    return JSON.stringify(wire)
  }

  if (content.type === 'intake_request') {
    // IntakeRequestContent is decrypt-only; it is constructed inside
    // decryptRow / drainSystemInbox early-exits from the anon-built plaintext
    // payload and never serialized. Defensive throw catches accidental
    // attempts to re-broadcast a received intake-request as a normal message.
    throw new Error('intake_request content is not serializable')
  }

  if (content.type === 'oncall_call') {
    // Decrypt-only, like intake_request — built inside the oncall early-exits
    // from SYSTEM-authored plaintext jsonb, never re-broadcast as a message.
    throw new Error('oncall_call content is not serializable')
  }

  const wire: WireVoice = {
    t: 'v',
    mime: content.mime,
    key: content.key,
    path: content.path,
    dur: content.duration,
    wf: content.waveform,
  }
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
        plaintext: 'Photo',
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

    if (wire.t === 'v') {
      return {
        plaintext: 'Voice message',
        content: {
          type: 'voice',
          mime: wire.mime,
          key: wire.key,
          path: wire.path,
          duration: wire.dur,
          waveform: wire.wf,
          ...(replyTo && { replyTo }),
        },
        replyTo,
      }
    }

    if (wire.t === 'e') {
      const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
      const action = actionMap[wire.a] ?? 'create'
      return {
        plaintext: '[calendar event]',
        content: {
          type: 'calendar_event',
          action,
          data: wire.d as CalendarEventPayload,
        } satisfies CalendarEventContent,
      }
    }

    if (wire.t === 'o') {
      const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
      const action = actionMap[wire.a] ?? 'create'
      return {
        plaintext: '[map overlay]',
        content: {
          type: 'map_overlay',
          action,
          data: wire.d as MapOverlayPayload,
        } satisfies MapOverlayContent,
      }
    }

    if (wire.t === 'mf') {
      const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
      const action = actionMap[wire.a] ?? 'create'
      return {
        plaintext: '[map feature]',
        content: {
          type: 'map_feature',
          action,
          data: {
            overlay_id: wire.o,
            ...(wire.c && { clinic_id: wire.c }),
            feature: wire.f as unknown as MapFeaturePayload['feature'],
          },
        } satisfies MapFeatureContent,
      }
    }

    if (wire.t === 'r') {
      const refKind = wire.k === 'ce' ? 'calendar-event' : wire.k === 'pi' ? 'property-item' : 'map-overlay'
      return {
        plaintext: wire.l,
        content: {
          type: 'shared_ref',
          refKind,
          refId: wire.id,
          label: wire.l,
          ...(wire.s && { subLabel: wire.s }),
          ...(wire.f && { featureId: wire.f }),
        } satisfies SharedRefContent,
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
