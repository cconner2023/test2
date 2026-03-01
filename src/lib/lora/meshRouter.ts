/**
 * LoRa Mesh — core mesh router.
 *
 * Processes incoming LoRa frames, creates witness records, and forwards
 * or delivers messages. This is the "brain" of the mesh node.
 *
 * Forwarding flow (handleIncoming):
 *   1. Decode frame from raw bytes
 *   2. Dedup check via witness store
 *   3. Drop if hop count exceeds maxHops
 *   4. Record witness (prevHop → nextHop)
 *   5. Deliver locally if addressed to us, or forward to next hop
 *
 * Outbound flow (sendToMesh):
 *   1. Look up route to destination
 *   2. Construct frame with sequence, timestamp, path
 *   3. Segment if payload too large
 *   4. Encode and send via BLE adapter
 */

import { ok, err, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import type {
  LoRaFrame,
  ConfirmationFrame,
  LoRaNodeId,
  WitnessRecord,
  RouteEntry,
} from './types'
import {
  LORA_MAX_PAYLOAD,
  LORA_HEADER_FIXED,
  LORA_PATH_ENTRY,
  LORA_SIGNATURE,
  LORA_MAX_HOPS,
  ROUTE_TTL_DAYS,
} from './types'
import {
  encodeFrame,
  decodeFrame,
  encodeConfirmation,
  decodeConfirmation,
  shortIdToHex,
  segmentPayload,
  reassemblePayload,
  uuidToBytes,
} from './wireFormat'
import {
  saveWitness,
  hasWitnessed,
  saveRoute,
  getBestRoute,
  updateRouteSuccess,
  pruneExpiredWitnesses,
  pruneExpiredRoutes,
  enforceWitnessBudget,
  enforceRouteBudget,
} from './loraDb'
import type { BleAdapter } from './bleAdapter'

const logger = createLogger('MeshRouter')

/** Pending confirmation tracker with timeout. */
interface PendingConfirmation {
  messageId: string
  sentAt: number        // Date.now()
  recipientHex: string
}

/** Pending segmented frame reassembly. */
interface PendingReassembly {
  segments: Map<number, Uint8Array>
  total: number
  firstSeen: number
}

/** How long to wait for confirmation before giving up (ms). */
const CONFIRMATION_TIMEOUT = 48 * 60 * 60 * 1000 // 48 hours

/** How long to wait for all segments of a frame (ms). */
const REASSEMBLY_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export class MeshRouter {
  private localNode: LoRaNodeId
  private bleAdapter: BleAdapter
  private onMessageReceived: (frame: LoRaFrame) => void
  private running = false
  private sequence = 0

  // Pending confirmations keyed by messageId hex
  private pendingConfirmations = new Map<string, PendingConfirmation>()

  // Pending reassembly keyed by messageId hex
  private pendingReassembly = new Map<string, PendingReassembly>()

  // HMAC key for signing frames (derived lazily)
  private signingKey: CryptoKey | null = null

  constructor(
    localNode: LoRaNodeId,
    bleAdapter: BleAdapter,
    onMessageReceived: (frame: LoRaFrame) => void,
  ) {
    this.localNode = localNode
    this.bleAdapter = bleAdapter
    this.onMessageReceived = onMessageReceived
  }

  // ---- Lifecycle ----

  start(): void {
    if (this.running) return
    this.running = true
    this.deriveSigningKey().catch(() => {})
    logger.info(`MeshRouter started (node=${this.localNode.shortIdHex})`)
  }

  stop(): void {
    this.running = false
    this.pendingConfirmations.clear()
    this.pendingReassembly.clear()
    logger.info('MeshRouter stopped')
  }

  // ---- Incoming Frame Processing ----

  /** Process a raw frame received from BLE. */
  async handleIncoming(rawBytes: Uint8Array): Promise<void> {
    if (!this.running) return

    // Try to decode as data frame first
    const frame = decodeFrame(rawBytes)
    if (!frame) return

    // Handle based on type
    if (frame.type === 0x02) {
      const conf = decodeConfirmation(rawBytes)
      if (conf) await this.handleConfirmation(conf)
      return
    }

    if (frame.type === 0x03) {
      // KillSwitch — mark witness as confirmed, stop forwarding
      const msgIdHex = shortIdToHex(frame.messageId.subarray(0, 8)) +
        shortIdToHex(frame.messageId.subarray(8, 16))
      const pending = this.pendingConfirmations.get(msgIdHex)
      if (pending) this.pendingConfirmations.delete(msgIdHex)
      return
    }

    // Data frame (0x01)
    const msgIdHex = bytesToHexFull(frame.messageId)

    // Dedup check
    if (await hasWitnessed(msgIdHex)) {
      logger.info(`Dedup: already witnessed ${msgIdHex.substring(0, 8)}…`)
      return
    }

    // TTL check
    if (frame.hopCount >= frame.maxHops) {
      logger.info(`TTL exceeded for ${msgIdHex.substring(0, 8)}… (hops=${frame.hopCount})`)
      return
    }

    const senderHex = shortIdToHex(frame.senderId)
    const recipientHex = shortIdToHex(frame.recipientId)

    // Determine prevHop: last entry in path, or sender if no path
    const prevHopBytes = frame.pathLength > 0
      ? frame.path.slice((frame.pathLength - 1) * LORA_PATH_ENTRY, frame.pathLength * LORA_PATH_ENTRY)
      : frame.senderId
    const prevHopHex = shortIdToHex(prevHopBytes)

    // Is this addressed to us?
    const isForUs = recipientHex === this.localNode.shortIdHex

    // Handle segmented frames
    if (frame.segmentInfo !== 0) {
      const segIndex = (frame.segmentInfo >> 4) & 0x0f
      const segTotal = frame.segmentInfo & 0x0f

      let pending = this.pendingReassembly.get(msgIdHex)
      if (!pending) {
        pending = { segments: new Map(), total: segTotal, firstSeen: Date.now() }
        this.pendingReassembly.set(msgIdHex, pending)
      }

      pending.segments.set(segIndex, frame.payload)

      const reassembled = reassemblePayload(pending.segments, pending.total)
      if (!reassembled) {
        // Still waiting for more segments — record partial witness
        return
      }

      // Complete — replace payload and clear segmentInfo
      frame.payload = reassembled
      frame.segmentInfo = 0
      this.pendingReassembly.delete(msgIdHex)
    }

    // Record witness
    const witness: WitnessRecord = {
      messageId: msgIdHex,
      senderId: senderHex,
      recipientId: recipientHex,
      sequence: frame.sequence,
      timestamp: frame.timestamp,
      prevHop: prevHopHex,
      nextHop: isForUs ? 'self' : this.localNode.shortIdHex,
      createdAt: Date.now(),
      confirmed: false,
    }
    await saveWitness(witness)

    // Learn route from the path
    await this.learnRoute(frame)

    if (isForUs) {
      // Deliver locally
      logger.info(`Delivering message ${msgIdHex.substring(0, 8)}… from ${senderHex.substring(0, 8)}…`)
      this.onMessageReceived(frame)

      // Send confirmation back
      await this.sendConfirmation(frame)
    } else {
      // Forward: increment hop count, append self to path, re-encode
      await this.forwardFrame(frame)
    }
  }

  // ---- Confirmation Handling ----

  async handleConfirmation(conf: ConfirmationFrame): Promise<void> {
    const msgIdHex = bytesToHexFull(conf.messageId)
    const recipientHex = shortIdToHex(conf.recipientId)

    // Is this confirmation for us?
    if (recipientHex === this.localNode.shortIdHex) {
      logger.info(`Confirmation received for ${msgIdHex.substring(0, 8)}…`)
      this.pendingConfirmations.delete(msgIdHex)
      await updateRouteSuccess(shortIdToHex(conf.senderId))
      return
    }

    // Not for us — propagate along reverse path
    // (confirmation routing follows learned routes back to sender)
    if (this.bleAdapter.isConnected()) {
      const encoded = encodeConfirmation(conf)
      await this.bleAdapter.send(encoded)
    }
  }

  // ---- Outbound ----

  /**
   * Send a payload to a destination via the mesh.
   * Returns the messageId as a hex string.
   */
  async sendToMesh(
    recipientShortId: string,
    payload: Uint8Array,
  ): Promise<Result<string>> {
    if (!this.bleAdapter.isConnected()) {
      return err('BLE not connected')
    }

    const messageId = uuidToBytes(crypto.randomUUID())
    const msgIdHex = bytesToHexFull(messageId)
    const now = Math.floor(Date.now() / 1000)
    const seq = this.sequence++

    // Look up route
    const route = await getBestRoute(recipientShortId)
    const maxHops = route ? LORA_MAX_HOPS : 3 // Discovery uses smaller TTL

    // Parse recipient short ID
    const recipientBytes = hexToBytes(recipientShortId)

    // Calculate available payload space
    const pathLen = 0 // Outbound starts with empty path
    const availablePayload = LORA_MAX_PAYLOAD - LORA_HEADER_FIXED - (pathLen * LORA_PATH_ENTRY) - LORA_SIGNATURE

    // Segment if needed
    const segments = segmentPayload(payload, availablePayload)

    for (let i = 0; i < segments.length; i++) {
      const segInfo = segments.length === 1 ? 0 : ((i << 4) | (segments.length & 0x0f))

      const frame: LoRaFrame = {
        version: 0x01,
        type: 0x01,
        messageId,
        senderId: this.localNode.shortId,
        recipientId: recipientBytes,
        sequence: seq,
        timestamp: now,
        hopCount: 0,
        maxHops,
        segmentInfo: segInfo,
        pathLength: 0,
        path: new Uint8Array(0),
        payload: segments[i],
        signature: new Uint8Array(LORA_SIGNATURE),
      }

      // Sign the frame
      const encoded = encodeFrame(frame)
      if (this.signingKey) {
        const sig = await this.computeFrameSignature(encoded)
        // Replace last 8 bytes with real signature
        encoded.set(sig, encoded.length - LORA_SIGNATURE)
      }

      const sendResult = await this.bleAdapter.send(encoded)
      if (!sendResult.ok) return err(sendResult.error)
    }

    // Track pending confirmation
    this.pendingConfirmations.set(msgIdHex, {
      messageId: msgIdHex,
      sentAt: Date.now(),
      recipientHex: recipientShortId,
    })

    // Record outbound witness
    await saveWitness({
      messageId: msgIdHex,
      senderId: this.localNode.shortIdHex,
      recipientId: recipientShortId,
      sequence: seq,
      timestamp: now,
      prevHop: 'self',
      nextHop: route?.nextHop ?? 'broadcast',
      createdAt: Date.now(),
      confirmed: false,
    })

    logger.info(`Sent to mesh: ${msgIdHex.substring(0, 8)}… → ${recipientShortId.substring(0, 8)}… (${segments.length} segment(s))`)
    return ok(msgIdHex)
  }

  // ---- Maintenance ----

  /** Run periodic cleanup on witnesses and routes. */
  async pruneStaleData(): Promise<void> {
    await pruneExpiredWitnesses()
    await pruneExpiredRoutes()
    await enforceWitnessBudget()
    await enforceRouteBudget()
    this.pruneReassemblyBuffer()
    this.pruneConfirmationTimeouts()
  }

  // ---- Internal ----

  private async forwardFrame(frame: LoRaFrame): Promise<void> {
    if (!this.bleAdapter.isConnected()) return

    // Increment hop count
    frame.hopCount++

    // Append self to path
    const newPath = new Uint8Array(frame.path.length + LORA_PATH_ENTRY)
    newPath.set(frame.path)
    newPath.set(this.localNode.shortId, frame.path.length)
    frame.path = newPath
    frame.pathLength++

    const encoded = encodeFrame(frame)

    // Re-sign
    if (this.signingKey) {
      const sig = await this.computeFrameSignature(encoded)
      encoded.set(sig, encoded.length - LORA_SIGNATURE)
    }

    const result = await this.bleAdapter.send(encoded)
    if (result.ok) {
      const msgIdHex = bytesToHexFull(frame.messageId)
      logger.info(`Forwarded ${msgIdHex.substring(0, 8)}… (hop=${frame.hopCount})`)
    }
  }

  private async sendConfirmation(originalFrame: LoRaFrame): Promise<void> {
    if (!this.bleAdapter.isConnected()) return

    const conf: ConfirmationFrame = {
      version: 0x01,
      type: 0x02,
      messageId: originalFrame.messageId,
      recipientId: originalFrame.senderId,  // confirm back to original sender
      senderId: this.localNode.shortId,
      timestamp: Math.floor(Date.now() / 1000),
      signature: new Uint8Array(LORA_SIGNATURE),
    }

    const encoded = encodeConfirmation(conf)

    if (this.signingKey) {
      const sig = await this.computeFrameSignature(encoded)
      encoded.set(sig, encoded.length - LORA_SIGNATURE)
    }

    await this.bleAdapter.send(encoded)
  }

  /** Learn routes from an incoming frame's path field. */
  private async learnRoute(frame: LoRaFrame): Promise<void> {
    if (frame.pathLength === 0) return

    const senderHex = shortIdToHex(frame.senderId)
    const now = Math.floor(Date.now() / 1000)
    const pathHops: string[] = []

    // Extract all hop IDs from path
    for (let i = 0; i < frame.pathLength; i++) {
      const hop = frame.path.slice(i * LORA_PATH_ENTRY, (i + 1) * LORA_PATH_ENTRY)
      pathHops.push(shortIdToHex(hop))
    }

    // We can now reach the sender via the first hop in the path
    // (reverse the path for the return route)
    const reversePath = [senderHex, ...pathHops.reverse(), this.localNode.shortIdHex]

    const entry: RouteEntry = {
      destinationId: senderHex,
      nextHop: pathHops[pathHops.length - 1] ?? senderHex, // last reversed = first original hop
      fullPath: reversePath,
      priority: Math.max(0, 128 - frame.hopCount * 10), // fewer hops = higher priority
      lastSuccess: now,
      ttl: now + (ROUTE_TTL_DAYS * 24 * 60 * 60),
    }

    await saveRoute(entry)
  }

  private async deriveSigningKey(): Promise<void> {
    try {
      // Derive HMAC key from the user's ID
      const keyMaterial = new TextEncoder().encode(this.localNode.userId + ':lora-mesh-hmac')
      this.signingKey = await crypto.subtle.importKey(
        'raw',
        await crypto.subtle.digest('SHA-256', keyMaterial),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
    } catch (e) {
      logger.warn('Failed to derive signing key:', e)
    }
  }

  private async computeFrameSignature(encoded: Uint8Array): Promise<Uint8Array> {
    if (!this.signingKey) return new Uint8Array(LORA_SIGNATURE)
    // Sign everything except the last 8 bytes (signature field)
    const toSign = encoded.subarray(0, encoded.length - LORA_SIGNATURE)
    const sig = await crypto.subtle.sign('HMAC', this.signingKey, toSign)
    return new Uint8Array(sig).slice(0, LORA_SIGNATURE)
  }

  private pruneReassemblyBuffer(): void {
    const now = Date.now()
    for (const [key, pending] of this.pendingReassembly) {
      if (now - pending.firstSeen > REASSEMBLY_TIMEOUT) {
        this.pendingReassembly.delete(key)
      }
    }
  }

  private pruneConfirmationTimeouts(): void {
    const now = Date.now()
    for (const [key, pending] of this.pendingConfirmations) {
      if (now - pending.sentAt > CONFIRMATION_TIMEOUT) {
        this.pendingConfirmations.delete(key)
      }
    }
  }
}

// ---- Internal Helpers ----

function bytesToHexFull(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
