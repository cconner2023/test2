/**
 * LoRa Mesh — Web Bluetooth BLE adapter.
 *
 * Hardware-agnostic abstraction that communicates with a LoRa radio module
 * via the Nordic UART Service (NUS) pattern over BLE. The radio module
 * firmware bridges BLE UART ↔ LoRa RF — the PWA is the intelligent node.
 *
 * Handles:
 * - BLE device discovery and connection via Web Bluetooth API
 * - GATT service/characteristic setup
 * - BLE-level fragmentation (MTU chunking, separate from LoRa segmentation)
 * - Auto-reconnect on disconnect
 * - Incoming frame reassembly from RX notifications
 */

import { ok, err, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import type { MeshAdapter, MeshAdapterState, MeshAdapterEvents } from './types'
import {
  LORA_BLE_SERVICE_UUID,
  LORA_BLE_TX_CHAR_UUID,
  LORA_BLE_RX_CHAR_UUID,
} from './types'

const logger = createLogger('BleAdapter')

/** Default BLE MTU. Negotiated up on connection if possible. */
const DEFAULT_MTU = 20

/** Time between auto-reconnect attempts (ms). */
const DEFAULT_RECONNECT_INTERVAL = 5000

export class BleAdapter implements MeshAdapter {
  state: MeshAdapterState = 'disconnected'

  private device: BluetoothDevice | null = null
  private server: BluetoothRemoteGATTServer | null = null
  private txChar: BluetoothRemoteGATTCharacteristic | null = null
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null
  private events: MeshAdapterEvents
  private mtu = DEFAULT_MTU
  private reconnectTimer: ReturnType<typeof setInterval> | null = null
  private disconnectHandler: (() => void) | null = null

  // RX reassembly buffer — BLE may split a single LoRa frame across
  // multiple notify events if it exceeds the BLE MTU.
  private rxBuffer: Uint8Array[] = []
  private rxExpectedLen = 0

  constructor(events: MeshAdapterEvents) {
    this.events = events
  }

  // ---- Connection Lifecycle ----

  /** Trigger browser BLE device picker filtered to LoRa service. */
  async requestDevice(): Promise<Result<void>> {
    try {
      if (!navigator.bluetooth) {
        return err('Web Bluetooth not available')
      }

      this.setState('connecting')

      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [LORA_BLE_SERVICE_UUID] }],
      })

      logger.info(`Device selected: ${this.device.name ?? 'unnamed'}`)
      return ok(undefined)
    } catch (e) {
      this.setState('error')
      const msg = e instanceof Error ? e.message : 'Device selection failed'
      // User cancelled is not an error
      if (msg.includes('cancelled') || msg.includes('canceled')) {
        this.setState('disconnected')
        return err('User cancelled device selection')
      }
      this.events.onError(msg)
      return err(msg)
    }
  }

  /** Connect to the previously selected device and set up GATT characteristics. */
  async connect(): Promise<Result<void>> {
    if (!this.device) return err('No device selected — call requestDevice() first')

    try {
      this.setState('connecting')

      // Connect GATT server
      this.server = await this.device.gatt!.connect()

      // Get NUS service
      const service = await this.server.getPrimaryService(LORA_BLE_SERVICE_UUID)

      // Get TX characteristic (write to module)
      this.txChar = await service.getCharacteristic(LORA_BLE_TX_CHAR_UUID)

      // Get RX characteristic (notify from module)
      this.rxChar = await service.getCharacteristic(LORA_BLE_RX_CHAR_UUID)
      await this.rxChar.startNotifications()
      this.rxChar.addEventListener(
        'characteristicvaluechanged',
        this.handleRxNotify,
      )

      // Listen for disconnect
      this.disconnectHandler = () => this.handleDisconnect()
      this.device.addEventListener('gattserverdisconnected', this.disconnectHandler)

      // Attempt MTU negotiation — not all browsers support this
      this.mtu = await this.negotiateMtu()

      this.setState('connected')
      logger.info(`Connected (MTU=${this.mtu})`)
      return ok(undefined)
    } catch (e) {
      this.setState('error')
      const msg = e instanceof Error ? e.message : 'Connection failed'
      this.events.onError(msg)
      return err(msg)
    }
  }

  /** Disconnect from the device. */
  disconnect(): void {
    this.stopAutoReconnect()

    if (this.rxChar) {
      this.rxChar.removeEventListener(
        'characteristicvaluechanged',
        this.handleRxNotify,
      )
      this.rxChar.stopNotifications().catch(() => {})
      this.rxChar = null
    }

    if (this.device && this.disconnectHandler) {
      this.device.removeEventListener('gattserverdisconnected', this.disconnectHandler)
      this.disconnectHandler = null
    }

    if (this.server?.connected) {
      this.server.disconnect()
    }

    this.server = null
    this.txChar = null
    this.rxBuffer = []
    this.rxExpectedLen = 0
    this.setState('disconnected')
    logger.info('Disconnected')
  }

  isConnected(): boolean {
    return this.state === 'connected' && !!this.server?.connected
  }

  // ---- Data Transfer ----

  /** Send raw bytes to the LoRa module via TX characteristic. */
  async send(data: Uint8Array): Promise<Result<void>> {
    if (!this.txChar || !this.isConnected()) {
      return err('Not connected')
    }

    try {
      // BLE-level fragmentation: chunk data to fit MTU
      // First 2 bytes of first chunk: total frame length (uint16 big-endian)
      const chunks = this.chunkForBle(data)

      for (const chunk of chunks) {
        await this.txChar.writeValueWithoutResponse(chunk)
      }

      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Send failed'
      this.events.onError(msg)
      return err(msg)
    }
  }

  // ---- Auto-Reconnect ----

  startAutoReconnect(intervalMs = DEFAULT_RECONNECT_INTERVAL): void {
    this.stopAutoReconnect()
    this.reconnectTimer = setInterval(async () => {
      if (this.state !== 'disconnected' || !this.device) return

      logger.info('Attempting auto-reconnect...')
      const result = await this.connect()
      if (result.ok) {
        this.stopAutoReconnect()
      }
    }, intervalMs)
  }

  stopAutoReconnect(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ---- Internal ----

  private setState(state: MeshAdapterState): void {
    this.state = state
    this.events.onStateChange(state)
  }

  private handleDisconnect(): void {
    logger.warn('GATT server disconnected')
    this.server = null
    this.txChar = null
    this.rxChar = null
    this.rxBuffer = []
    this.rxExpectedLen = 0
    this.setState('disconnected')
  }

  /**
   * Handle incoming BLE notification from RX characteristic.
   * Reassembles BLE-fragmented frames before passing to onReceive.
   *
   * Protocol: first chunk starts with 2-byte big-endian total length.
   * Subsequent chunks are raw continuation bytes until total length reached.
   */
  private handleRxNotify = (event: Event): void => {
    const char = event.target as BluetoothRemoteGATTCharacteristic
    const value = char.value
    if (!value) return

    const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

    if (this.rxExpectedLen === 0) {
      // New frame — first 2 bytes are total length
      if (chunk.length < 2) return
      const totalLen = (chunk[0] << 8) | chunk[1]
      this.rxExpectedLen = totalLen
      this.rxBuffer = [chunk.subarray(2)]
    } else {
      // Continuation of current frame
      this.rxBuffer.push(chunk)
    }

    // Check if we have all bytes
    const received = this.rxBuffer.reduce((sum, c) => sum + c.length, 0)
    if (received >= this.rxExpectedLen) {
      // Reassemble
      const frame = new Uint8Array(this.rxExpectedLen)
      let offset = 0
      for (const part of this.rxBuffer) {
        const toCopy = Math.min(part.length, this.rxExpectedLen - offset)
        frame.set(part.subarray(0, toCopy), offset)
        offset += toCopy
      }

      this.rxBuffer = []
      this.rxExpectedLen = 0
      this.events.onReceive(frame)
    }
  }

  /**
   * Chunk outgoing data for BLE MTU.
   * First chunk includes a 2-byte big-endian length prefix.
   */
  private chunkForBle(data: Uint8Array): Uint8Array[] {
    const chunks: Uint8Array[] = []

    // First chunk: 2-byte length header + data
    const firstPayloadSize = this.mtu - 2
    const header = new Uint8Array(2)
    header[0] = (data.length >> 8) & 0xff
    header[1] = data.length & 0xff

    const firstChunk = new Uint8Array(Math.min(2 + data.length, this.mtu))
    firstChunk.set(header)
    firstChunk.set(data.subarray(0, firstPayloadSize), 2)
    chunks.push(firstChunk)

    // Remaining chunks: raw data
    let offset = firstPayloadSize
    while (offset < data.length) {
      const end = Math.min(offset + this.mtu, data.length)
      chunks.push(data.slice(offset, end))
      offset = end
    }

    return chunks
  }

  /** Attempt BLE MTU negotiation. Falls back to default if unsupported. */
  private async negotiateMtu(): Promise<number> {
    // Web Bluetooth doesn't expose MTU negotiation directly.
    // Some implementations support requestMtu() on the server object.
    // We try it and fall back to default.
    try {
      const server = this.server as unknown as Record<string, unknown>
      if (typeof server?.requestMtu === 'function') {
        const negotiated = await (server.requestMtu as (mtu: number) => Promise<number>)(247)
        // Actual payload is MTU - 3 (ATT header)
        return Math.max(DEFAULT_MTU, negotiated - 3)
      }
    } catch {
      // Not supported — use default
    }
    return DEFAULT_MTU
  }
}
