/**
 * WebRTC peer connection lifecycle.
 *
 * Factory function returning an imperative API for a single call.
 * Create one per call, dispose via cleanup().
 */

import { RTC_CONFIG } from './types'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('WebRTC')

export interface WebRTCCallbacks {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void
  onTrack: (stream: MediaStream) => void
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
}

export interface WebRTCInitOptions {
  video?: boolean
}

export interface WebRTCService {
  init: (callbacks: WebRTCCallbacks, options?: WebRTCInitOptions) => Promise<MediaStream>
  createOffer: () => Promise<RTCSessionDescriptionInit>
  handleOffer: (sdp: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>
  handleAnswer: (sdp: RTCSessionDescriptionInit) => Promise<void>
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>
  setMuted: (muted: boolean) => void
  isMuted: () => boolean
  setVideoEnabled: (enabled: boolean) => void
  isVideoOff: () => boolean
  cleanup: () => void
}

export function createWebRTCService(): WebRTCService {
  let pc: RTCPeerConnection | null = null
  let localStream: MediaStream | null = null

  const init: WebRTCService['init'] = async (callbacks, options) => {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: options?.video ?? false,
    })
    pc = new RTCPeerConnection(RTC_CONFIG)

    // Add local tracks to the connection
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream)
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        callbacks.onIceCandidate(e.candidate.toJSON())
      }
    }

    pc.ontrack = (e) => {
      logger.debug('Remote track received')
      callbacks.onTrack(e.streams[0])
    }

    pc.onconnectionstatechange = () => {
      if (pc) {
        logger.debug('Connection state:', pc.connectionState)
        callbacks.onConnectionStateChange(pc.connectionState)
      }
    }

    return localStream
  }

  const createOffer: WebRTCService['createOffer'] = async () => {
    if (!pc) throw new Error('PeerConnection not initialized')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    return offer
  }

  const handleOffer: WebRTCService['handleOffer'] = async (sdp) => {
    if (!pc) throw new Error('PeerConnection not initialized')
    await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return answer
  }

  const handleAnswer: WebRTCService['handleAnswer'] = async (sdp) => {
    if (!pc) throw new Error('PeerConnection not initialized')
    await pc.setRemoteDescription(new RTCSessionDescription(sdp))
  }

  const addIceCandidate: WebRTCService['addIceCandidate'] = async (candidate) => {
    if (!pc) return
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (err) {
      logger.warn('Failed to add ICE candidate:', err)
    }
  }

  const setMuted: WebRTCService['setMuted'] = (muted) => {
    if (!localStream) return
    for (const track of localStream.getAudioTracks()) {
      track.enabled = !muted
    }
  }

  const isMuted: WebRTCService['isMuted'] = () => {
    if (!localStream) return false
    const track = localStream.getAudioTracks()[0]
    return track ? !track.enabled : false
  }

  const setVideoEnabled: WebRTCService['setVideoEnabled'] = (enabled) => {
    if (!localStream) return
    for (const track of localStream.getVideoTracks()) {
      track.enabled = enabled
    }
  }

  const isVideoOff: WebRTCService['isVideoOff'] = () => {
    if (!localStream) return true
    const track = localStream.getVideoTracks()[0]
    return track ? !track.enabled : true
  }

  const cleanup: WebRTCService['cleanup'] = () => {
    if (localStream) {
      for (const track of localStream.getTracks()) {
        track.stop()
      }
      localStream = null
    }
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
      pc = null
    }
  }

  return { init, createOffer, handleOffer, handleAnswer, addIceCandidate, setMuted, isMuted, setVideoEnabled, isVideoOff, cleanup }
}
