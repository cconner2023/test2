/**
 * Zustand store for voice call state.
 *
 * Manages call lifecycle (idle → ringing → connecting → connected → ended → idle).
 * Components subscribe to individual slices for minimal re-renders.
 */

import { create } from 'zustand'
import type { CallStatus, CallDirection, CallMode, CallPeer } from '../lib/webrtc/types'
import { useAuthStore } from './useAuthStore'

interface CallState {
  status: CallStatus
  direction: CallDirection | null
  peer: CallPeer | null
  connectedAt: number | null
  endReason: string | null
  isMuted: boolean
  callMode: CallMode
  isVideoOff: boolean
}

interface CallActions {
  startRinging: (direction: CallDirection, peer: CallPeer, callMode?: CallMode) => void
  setConnecting: () => void
  setConnected: () => void
  endCall: (reason: string) => void
  toggleMute: () => void
  toggleVideo: () => void
  reset: () => void
}

const initialState: CallState = {
  status: 'idle',
  direction: null,
  peer: null,
  connectedAt: null,
  endReason: null,
  isMuted: false,
  callMode: 'audio',
  isVideoOff: false,
}

/** End reasons for an outgoing call that never connected — the caller may leave
 *  a voicemail. The overlay stays open (auto-reset suppressed) in these cases. */
const VOICEMAIL_REASONS = new Set(['No answer', 'Call declined', 'Failed to connect', 'Connection failed'])

export const useCallStore = create<CallState & CallActions>()((set, get) => ({
  ...initialState,

  startRinging: (direction, peer, callMode) => {
    set({ status: 'ringing', direction, peer, connectedAt: null, endReason: null, isMuted: false, callMode: callMode ?? 'audio', isVideoOff: false })
  },

  setConnecting: () => {
    set({ status: 'connecting' })
  },

  setConnected: () => {
    set({ status: 'connected', connectedAt: Date.now() })
  },

  endCall: (reason) => {
    const st = get()
    set({ status: 'ended', endReason: reason })
    // Keep the overlay open so the caller can leave a voicemail when an
    // outgoing call never connected. Otherwise auto-reset to idle after 2s.
    // Dev-gated until voicemail is validated in prod — non-dev calls keep the
    // original 2s auto-reset so they never get stuck in the ended state.
    const canVoicemail = useAuthStore.getState().isDevRole && st.direction === 'outgoing' && st.connectedAt === null && VOICEMAIL_REASONS.has(reason)
    if (canVoicemail) return
    setTimeout(() => {
      // Only reset if still in 'ended' state (avoid race with a new call)
      set((state) => (state.status === 'ended' ? initialState : state))
    }, 2000)
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }))
  },

  toggleVideo: () => {
    set((state) => ({ isVideoOff: !state.isVideoOff }))
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

/** True when the ended call is an outgoing, never-connected attempt the caller
 *  can leave a voicemail for. */
export const selectCanLeaveVoicemail = (state: CallState) =>
  state.status === 'ended' &&
  state.direction === 'outgoing' &&
  state.connectedAt === null &&
  !!state.endReason &&
  VOICEMAIL_REASONS.has(state.endReason)
