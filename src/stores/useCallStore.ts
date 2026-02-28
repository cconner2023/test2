/**
 * Zustand store for voice call state.
 *
 * Manages call lifecycle (idle → ringing → connecting → connected → ended → idle).
 * Components subscribe to individual slices for minimal re-renders.
 */

import { create } from 'zustand'
import type { CallStatus, CallDirection, CallPeer } from '../lib/webrtc/types'

interface CallState {
  status: CallStatus
  direction: CallDirection | null
  peer: CallPeer | null
  connectedAt: number | null
  endReason: string | null
  isMuted: boolean
}

interface CallActions {
  startRinging: (direction: CallDirection, peer: CallPeer) => void
  setConnecting: () => void
  setConnected: () => void
  endCall: (reason: string) => void
  toggleMute: () => void
  reset: () => void
}

const initialState: CallState = {
  status: 'idle',
  direction: null,
  peer: null,
  connectedAt: null,
  endReason: null,
  isMuted: false,
}

export const useCallStore = create<CallState & CallActions>()((set) => ({
  ...initialState,

  startRinging: (direction, peer) => {
    set({ status: 'ringing', direction, peer, connectedAt: null, endReason: null, isMuted: false })
  },

  setConnecting: () => {
    set({ status: 'connecting' })
  },

  setConnected: () => {
    set({ status: 'connected', connectedAt: Date.now() })
  },

  endCall: (reason) => {
    set({ status: 'ended', endReason: reason })
    // Auto-reset to idle after 2 seconds
    setTimeout(() => {
      // Only reset if still in 'ended' state (avoid race with a new call)
      set((state) => (state.status === 'ended' ? initialState : state))
    }, 2000)
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }))
  },

  reset: () => {
    set(initialState)
  },
}))

/** True when a call is actively ringing, connecting, or connected. */
export const selectIsInCall = (state: CallState) =>
  state.status === 'ringing' || state.status === 'connecting' || state.status === 'connected'

/** True when the call UI overlay should be shown. */
export const selectShowCallUI = (state: CallState) => state.status !== 'idle'
