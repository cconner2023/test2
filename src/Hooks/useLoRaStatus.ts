/**
 * useLoRaStatus — reactive hook for LoRa mesh connection state and stats.
 *
 * Subscribes to adapter state changes and polls mesh health stats
 * while connected. Wraps connectLoRa/disconnectLoRa for easy UI binding.
 */

import { useState, useEffect, useCallback } from 'react'
import type { MeshAdapterState } from '../lib/lora/types'
import type { Result } from '../lib/result'
import { LORA_MESH_ENABLED } from '../lib/featureFlags'
import {
  onLoRaStateChange,
  getLoRaState,
  getLoRaMeshStats,
  connectLoRa,
  disconnectLoRa,
} from '../lib/signal/signalService'

interface LoRaStatus {
  enabled: boolean
  state: MeshAdapterState
  witnessCount: number
  routeCount: number
  connect: () => Promise<Result<void>>
  disconnect: () => void
}

export function useLoRaStatus(): LoRaStatus {
  const [state, setState] = useState<MeshAdapterState>(getLoRaState)
  const [witnessCount, setWitnessCount] = useState(0)
  const [routeCount, setRouteCount] = useState(0)

  // Subscribe to adapter state changes
  useEffect(() => {
    if (!LORA_MESH_ENABLED) return

    const unsub = onLoRaStateChange((newState) => {
      setState(newState)
    })

    return unsub
  }, [])

  // Poll mesh stats every 10s while connected
  useEffect(() => {
    if (!LORA_MESH_ENABLED || state !== 'connected') {
      setWitnessCount(0)
      setRouteCount(0)
      return
    }

    const poll = async () => {
      const stats = await getLoRaMeshStats()
      if (stats) {
        setWitnessCount(stats.witnessCount)
        setRouteCount(stats.routeCount)
      }
    }

    poll()
    const timer = setInterval(poll, 10_000)
    return () => clearInterval(timer)
  }, [state])

  const connect = useCallback(() => connectLoRa(), [])
  const disconnect = useCallback(() => disconnectLoRa(), [])

  return {
    enabled: LORA_MESH_ENABLED,
    state,
    witnessCount,
    routeCount,
    connect,
    disconnect,
  }
}
