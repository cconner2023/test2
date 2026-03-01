/**
 * LoRa Mesh — platform-aware adapter factory.
 *
 * Detects the runtime platform and returns the appropriate MeshAdapter.
 * Currently only BleAdapter (Web Bluetooth) is implemented;
 * Tauri and Capacitor stubs fall back to BLE with a warning.
 */

import { createLogger } from '../../Utilities/Logger'
import type { MeshAdapter, MeshAdapterEvents } from './types'

const logger = createLogger('AdapterFactory')

export type Platform = 'pwa' | 'tauri' | 'capacitor'

/** Detect which runtime platform we're on. */
export function detectPlatform(): Platform {
  if (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  ) {
    return 'tauri'
  }
  if (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).Capacitor
  ) {
    return 'capacitor'
  }
  return 'pwa'
}

/**
 * Create the appropriate MeshAdapter for the current platform.
 * Uses lazy import so BLE code isn't loaded until needed.
 */
export async function createMeshAdapter(
  events: MeshAdapterEvents,
): Promise<MeshAdapter> {
  const platform = detectPlatform()

  if (platform === 'tauri') {
    logger.warn('Tauri native adapter not yet implemented — falling back to Web Bluetooth')
  } else if (platform === 'capacitor') {
    logger.warn('Capacitor native adapter not yet implemented — falling back to Web Bluetooth')
  }

  // All platforms currently use BleAdapter (Web Bluetooth)
  const { BleAdapter } = await import('./bleAdapter')
  return new BleAdapter(events)
}
