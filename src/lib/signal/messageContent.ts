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
 *   Shared bundle:  { t: "sb", k: "ce"|"mo", p, key, h, l, s?, sc } ← frozen self-contained object for cross-cluster ingest
 *   Reaction:       { t: "rx", id, e, r? }                  ← emoji reaction targeting another message (folded, never a bubble)
 */

import type { EventCategory, EventStatus, CategorySwatchId } from '../../Types/CalendarTypes'
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
  /** Per-event color override (swatch id). Operational/cosmetic only — not PHI. */
  color?: CategorySwatchId | null
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
  /** Algorithm id when this event was auto-logged from a completed clinical
   *  algorithm (WriteNote "log to calendar"). Operational only — not PHI. */
  encounter_algorithm_id?: string | null
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
 * Outside event-intake REQUEST content. Authored by the intake EDGE FUNCTION as a
 * normal SYSTEM group message (per-device X3DH, sender_device_id='edge') — so the
 * Signal Double-Ratchet/sealed-sender envelope provides the encryption end-to-end
 * and these fields are the DECRYPTED plaintext. It rides the standard group message
 * pipeline (decrypt → backup → vault → delete → render) with no bespoke crypto. The
 * server only ever stores ciphertext; event_intake_requests PHI columns stay NULL.
 * Both serializable (edge builds it) and parseable (recipient renders it as the
 * IntakeRequestCard). intake_id is the lifecycle handle for approve/decline.
 */
export interface IntakeRequestContent {
  type: 'intake_request'
  intake_id: string
  clinic_id: string
  requester_name: string
  requester_org: string | null
  requester_email: string
  /** ISO timestamp. */
  requested_start: string
  /** ISO timestamp. */
  requested_end: string
  title: string
}

/** Voicemail payload carried in a resolved oncall-call card. The audio is AES-256-GCM
 *  ciphertext (IV-prepended) stored as a blob in the message-attachments bucket — same
 *  shape as an internal VoiceContent. The AES key rides INSIDE the edge-authored Signal
 *  envelope (no seal-to-clinic-key), so the server holds ciphertext only and decryption
 *  capability = receiving the envelope (cluster membership). */
export interface OncallVoicemailData {
  /** Base64 AES-256-GCM key for the audio blob (carried inside the E2E envelope). */
  key: string
  /** Storage path in the message-attachments bucket (oncall/<clinic_id>/<uuid>.enc). */
  path: string
  mime: string
  duration: number
  waveform: number[]
}

/**
 * Resolved outside→on-call CALL card — the durable record of one on-call call. Authored
 * by the `oncall-resolve` EDGE FUNCTION as a real per-device SYSTEM Signal envelope
 * (sender_device_id='edge'), so these fields are the DECRYPTED plaintext and it rides the
 * normal group pipeline like IntakeRequestContent. The live ring (oncall-ring) is NOT a
 * content type — it routes to the call layer via the oncall signal bus, never stored.
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
 * Cross-cluster shared OBJECT BUNDLE — the frozen-value counterpart to a
 * shared_ref. Where a shared_ref is a live link that only resolves inside the
 * sending cluster, a shared_bundle carries a self-contained calendar event or
 * map overlay (uploaded as an encrypted blob to the message-attachments bucket)
 * so a recipient in ANOTHER cluster can re-materialize it as a brand-new local
 * copy in their own vault. The bundle blob is ciphertext; the AES `key` rides
 * here inside the E2E Signal envelope. No PHI — the bundle is projected to
 * operational fields at export (see src/lib/objectBundle.ts). Authored into a
 * 1:1 (or group) thread; renders as a tappable "Add to my cluster" card.
 */
export interface SharedBundleContent {
  type: 'shared_bundle'
  /** Which kind of object the bundle holds. */
  bundleKind: 'calendar-event' | 'map-overlay'
  /** Storage path of the encrypted bundle blob in message-attachments. */
  path: string
  /** Base64 AES-256-GCM key for the bundle blob (carried inside the E2E msg). */
  key: string
  /** sha-256 of the canonical bundle JSON — integrity + ingest idempotency. */
  contentHash: string
  /** Display label (event title / overlay name). Operational only — no PHI. */
  label: string
  /** Secondary line (date / feature count). Operational only. */
  subLabel?: string
  /** Human label of the originating cluster — shown as "from [cluster]". */
  sourceCluster: string
}

/**
 * Outside→cluster ONE-WAY message card — an outside party (QR + passphrase) drops a
 * short text note to the whole clinic cluster. Authored by the `outside-message-submit`
 * EDGE FUNCTION as a real per-device SYSTEM group message (sender_device_id='edge'),
 * so the Signal ratchet/sealed-sender envelope encrypts the body end-to-end and these
 * fields are the DECRYPTED plaintext — no seal-to-clinic-key, no bespoke crypto. It
 * rides the standard group pipeline (decrypt → backup → vault → delete → render),
 * byte-identical transport to IntakeRequestContent.
 */
export interface OutsideMessageContent {
  type: 'outside_message'
  message_id: string
  clinic_id: string
  requester_name: string
  /** Decrypted message body (operational vocabulary only — no PHI). */
  text: string
}

/**
 * Emoji reaction targeting another message. Carries ONLY the target's id, an
 * opaque emoji code, and a remove flag — never any free text, never PHI. It is
 * authored into a 1:1 or group thread and rides the standard send pipeline, but
 * is NEVER rendered as a bubble: the receive path folds it onto the target
 * message's `reactions` map (out-of-band, like calendar/overlay sync) and the
 * reactor identity is the message's senderId. `emoji` is an opaque code
 * (`up`|`down`|`heart`|`skull`|`bang`) resolved to a themed glyph by the UI —
 * the signal layer stays vocabulary-agnostic.
 */
export interface ReactionContent {
  type: 'reaction'
  /** Target message — its originId (preferred, shared across fan-out copies) or id. */
  targetId: string
  /** Opaque emoji code. Mapped to a themed SVG glyph by the UI layer. */
  emoji: string
  /** When true this un-reacts (removes the reactor from the target's set). */
  remove?: boolean
}

export type MessageContent = TextContent | ImageContent | VoiceContent | CalendarEventContent | MapOverlayContent | MapFeatureContent | SharedRefContent | SharedBundleContent | IntakeRequestContent | OncallCallContent | OutsideMessageContent | ReactionContent

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

/** Cross-cluster shared object bundle (frozen value, ingested into the receiver's vault). */
interface WireSharedBundle {
  t: 'sb'
  /** kind: 'ce' calendar event | 'mo' map overlay */
  k: 'ce' | 'mo'
  /** storage path of the encrypted bundle blob */
  p: string
  /** base64 AES key for the bundle blob */
  key: string
  /** sha-256 content hash */
  h: string
  /** label */
  l: string
  /** sub-label (optional) */
  s?: string
  /** source cluster label */
  sc: string
}

/** Outside event-intake request, authored by the edge fn inside the Signal envelope. */
interface WireIntake {
  t: 'ir'
  id: string
  /** clinic id */
  c: string
  /** requester name */
  n: string
  /** requester org (optional) */
  o?: string
  /** requester email */
  e: string
  /** requested start (ISO) */
  s: string
  /** requested end (ISO) */
  d: string
  /** title */
  ti: string
}

/** Outside→cluster one-way message, authored by the edge fn inside the Signal envelope. */
interface WireOutsideMessage {
  t: 'om'
  /** message id */
  id: string
  /** clinic id */
  c: string
  /** requester name */
  n: string
  /** body text */
  d: string
}

/** Resolved on-call call card, authored by the edge fn inside the Signal envelope. */
interface WireOncallCall {
  t: 'oc'
  /** call id */
  id: string
  /** clinic id */
  c: string
  /** requester name */
  n: string
  /** outcome */
  o: OncallCallContent['outcome']
  /** ended_at (ISO) */
  ea: string
  /** voicemail attachment ref (present only on voicemail) */
  vm?: {
    key: string
    path: string
    mime: string
    dur: number
    wf: number[]
  }
}

/** Emoji reaction targeting another message. Folded onto the target, never a bubble. */
interface WireReaction {
  t: 'rx'
  /** target message originId/id */
  id: string
  /** opaque emoji code */
  e: string
  /** 1 = remove (un-react); omitted = add */
  r?: 1
}

type WireContent = WireText | WireImage | WireVoice | WireCalendarEvent | WireMapOverlay | WireMapFeature | WireSharedRef | WireSharedBundle | WireIntake | WireOutsideMessage | WireOncallCall | WireReaction

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

  if (content.type === 'shared_bundle') {
    const kindMap = { 'calendar-event': 'ce', 'map-overlay': 'mo' } as const
    const wire: WireSharedBundle = {
      t: 'sb',
      k: kindMap[content.bundleKind],
      p: content.path,
      key: content.key,
      h: content.contentHash,
      l: content.label,
      sc: content.sourceCluster,
    }
    if (content.subLabel) wire.s = content.subLabel
    return JSON.stringify(wire)
  }

  if (content.type === 'intake_request') {
    // Serialized by the intake edge function as the plaintext INSIDE the SYSTEM
    // sealed envelope (then E2E-encrypted by the ratchet). Parsed back on the
    // recipient into the IntakeRequestCard.
    const wire: WireIntake = {
      t: 'ir',
      id: content.intake_id,
      c: content.clinic_id,
      n: content.requester_name,
      e: content.requester_email,
      s: content.requested_start,
      d: content.requested_end,
      ti: content.title,
    }
    if (content.requester_org) wire.o = content.requester_org
    return JSON.stringify(wire)
  }

  if (content.type === 'outside_message') {
    // Serialized by the outside-message-submit edge function as the plaintext
    // INSIDE the SYSTEM sealed envelope (then E2E-encrypted by the ratchet).
    const wire: WireOutsideMessage = {
      t: 'om',
      id: content.message_id,
      c: content.clinic_id,
      n: content.requester_name,
      d: content.text,
    }
    return JSON.stringify(wire)
  }

  if (content.type === 'reaction') {
    const wire: WireReaction = { t: 'rx', id: content.targetId, e: content.emoji }
    if (content.remove) wire.r = 1
    return JSON.stringify(wire)
  }

  if (content.type === 'oncall_call') {
    // Serialized by the oncall-resolve edge function as the plaintext INSIDE the
    // SYSTEM sealed envelope (then E2E-encrypted by the ratchet).
    const wire: WireOncallCall = {
      t: 'oc',
      id: content.call_id,
      c: content.clinic_id,
      n: content.requester_name,
      o: content.outcome,
      ea: content.ended_at,
    }
    if (content.voicemail) {
      wire.vm = {
        key: content.voicemail.key,
        path: content.voicemail.path,
        mime: content.voicemail.mime,
        dur: content.voicemail.duration,
        wf: content.voicemail.waveform,
      }
    }
    return JSON.stringify(wire)
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

    if (wire.t === 'sb') {
      const bundleKind = wire.k === 'ce' ? 'calendar-event' : 'map-overlay'
      return {
        plaintext: wire.l,
        content: {
          type: 'shared_bundle',
          bundleKind,
          path: wire.p,
          key: wire.key,
          contentHash: wire.h,
          label: wire.l,
          ...(wire.s && { subLabel: wire.s }),
          sourceCluster: wire.sc,
        } satisfies SharedBundleContent,
      }
    }

    if (wire.t === 'ir') {
      return {
        plaintext: '[event intake — request]',
        content: {
          type: 'intake_request',
          intake_id: wire.id,
          clinic_id: wire.c,
          requester_name: wire.n,
          requester_org: wire.o ?? null,
          requester_email: wire.e,
          requested_start: wire.s,
          requested_end: wire.d,
          title: wire.ti,
        } satisfies IntakeRequestContent,
      }
    }

    if (wire.t === 'om') {
      return {
        plaintext: wire.d,
        content: {
          type: 'outside_message',
          message_id: wire.id,
          clinic_id: wire.c,
          requester_name: wire.n,
          text: wire.d,
        } satisfies OutsideMessageContent,
      }
    }

    if (wire.t === 'rx') {
      return {
        plaintext: '[reaction]',
        content: {
          type: 'reaction',
          targetId: wire.id,
          emoji: wire.e,
          ...(wire.r ? { remove: true } : {}),
        } satisfies ReactionContent,
      }
    }

    if (wire.t === 'oc') {
      const content: OncallCallContent = {
        type: 'oncall_call',
        call_id: wire.id,
        clinic_id: wire.c,
        requester_name: wire.n,
        outcome: wire.o,
        ended_at: wire.ea,
        ...(wire.vm
          ? {
              voicemail: {
                key: wire.vm.key,
                path: wire.vm.path,
                mime: wire.vm.mime,
                duration: wire.vm.dur,
                waveform: wire.vm.wf,
              },
            }
          : {}),
      }
      return { plaintext: '[on-call]', content }
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
