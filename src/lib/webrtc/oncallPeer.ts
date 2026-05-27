/**
 * Non-trickle WebRTC peer for the outside→on-call leg.
 *
 * The shipped `webrtcService.ts` is trickle (per-candidate `onIceCandidate`),
 * which fits the medic↔medic Signal-message signaling. The on-call leg signals
 * over a POLLED credential-gated RPC (the anon caller has no inbox), so per-candidate
 * trickle is impractical — we gather all candidates then exchange one complete
 * offer/answer SDP. This helper waits for ICE gathering to complete (capped) and
 * returns the full `localDescription`. Used by BOTH the anon bundle and the medic
 * side, so it imports ONLY `RTC_CONFIG` (no `src/lib/signal/*`, anon-bundle-safe).
 */

import { RTC_CONFIG } from './types'

/** Cap the wait for STUN gathering so a hung/slow server can't stall the call. */
const GATHER_TIMEOUT_MS = 3000

function waitForGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    pc.addEventListener('icegatheringstatechange', onChange)
    setTimeout(finish, GATHER_TIMEOUT_MS)
  })
}

export interface OncallPeer {
  /** getUserMedia + RTCPeerConnection. Returns the local (mic) stream. */
  init: (callbacks: {
    onTrack: (stream: MediaStream) => void
    onConnectionStateChange: (state: RTCPeerConnectionState) => void
  }) => Promise<MediaStream>
  /** Caller side: full offer SDP with all candidates bundled. */
  createOffer: () => Promise<RTCSessionDescriptionInit>
  /** Callee side: accept the offer, return the full answer SDP with candidates. */
  createAnswer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>
  /** Caller side: apply the polled answer. */
  acceptAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>
  setMuted: (muted: boolean) => void
  cleanup: () => void
}

export function createOncallPeer(): OncallPeer {
  let pc: RTCPeerConnection | null = null
  let localStream: MediaStream | null = null

  return {
    init: async (callbacks) => {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      pc = new RTCPeerConnection(RTC_CONFIG)
      for (const track of localStream.getTracks()) pc.addTrack(track, localStream)
      pc.ontrack = (e) => callbacks.onTrack(e.streams[0])
      pc.onconnectionstatechange = () => {
        if (pc) callbacks.onConnectionStateChange(pc.connectionState)
      }
      return localStream
    },

    createOffer: async () => {
      if (!pc) throw new Error('peer not initialized')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForGathering(pc)
      return pc.localDescription?.toJSON() ?? offer
    },

    createAnswer: async (offer) => {
      if (!pc) throw new Error('peer not initialized')
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForGathering(pc)
      return pc.localDescription?.toJSON() ?? answer
    },

    acceptAnswer: async (answer) => {
      if (!pc) throw new Error('peer not initialized')
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    },

    setMuted: (muted) => {
      if (!localStream) return
      for (const track of localStream.getAudioTracks()) track.enabled = !muted
    },

    cleanup: () => {
      if (localStream) {
        for (const track of localStream.getTracks()) track.stop()
        localStream = null
      }
      if (pc) {
        pc.ontrack = null
        pc.onconnectionstatechange = null
        pc.close()
        pc = null
      }
    },
  }
}
