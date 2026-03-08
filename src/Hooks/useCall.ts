/**
 * useCall — Orchestration hook for WebRTC calls (audio & video).
 *
 * Mounted once via CallProvider. Manages the full call lifecycle:
 * signaling subscription, WebRTC setup, media playback, and cleanup.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { useCallStore } from '../stores/useCallStore'
import { createWebRTCService, type WebRTCService } from '../lib/webrtc/webrtcService'
import {
  createCallSignaling,
  listenForIncomingCalls,
  sendCallOffer,
  buildChannelName,
  type CallSignaling,
} from '../lib/webrtc/callSignaling'
import { RING_TIMEOUT_MS } from '../lib/webrtc/types'
import type { CallMode, CallPeer, CallOfferPayload, SignalingPayload } from '../lib/webrtc/types'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('UseCall')

export interface CallActions {
  startCall: (peer: CallPeer) => void
  startVideoCall: (peer: CallPeer) => void
  acceptCall: () => void
  declineCall: () => void
  hangUp: () => void
  toggleMute: () => void
  toggleVideo: () => void
  localStream: MediaStream | null
  remoteStream: MediaStream | null
}

export function useCall(): CallActions {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const signalingRef = useRef<CallSignaling | null>(null)
  const webrtcRef = useRef<WebRTCService | null>(null)
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingOfferRef = useRef<CallOfferPayload | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  // Keep a stable ref to profile display name for outgoing calls
  const profile = useAuthStore((s) => s.profile)
  const callerNameRef = useRef('')
  useEffect(() => {
    callerNameRef.current = [profile.rank, profile.lastName].filter(Boolean).join(' ') || profile.firstName || 'Unknown'
  }, [profile.rank, profile.lastName, profile.firstName])

  // Ensure we have a persistent audio element for remote playback
  useEffect(() => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio()
      remoteAudioRef.current.autoplay = true
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null
      }
    }
  }, [])

  // ── Cleanup helper ──────────────────────────────────────────────────────

  const cleanupCall = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
    webrtcRef.current?.cleanup()
    webrtcRef.current = null
    signalingRef.current?.leave()
    signalingRef.current = null
    pendingOfferRef.current = null
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    setLocalStream(null)
    setRemoteStream(null)
  }, [])

  // ── WebRTC init helper ──────────────────────────────────────────────────

  const initWebRTC = useCallback(async (video: boolean) => {
    const svc = createWebRTCService()
    webrtcRef.current = svc

    const stream = await svc.init({
      onIceCandidate: (candidate) => {
        signalingRef.current?.sendIceCandidate(candidate)
      },
      onTrack: (remote) => {
        setRemoteStream(remote)
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remote
        }
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          useCallStore.getState().setConnected()
        } else if (state === 'disconnected' || state === 'failed') {
          useCallStore.getState().endCall(state === 'failed' ? 'Connection failed' : 'Disconnected')
          cleanupCall()
        }
      },
    }, { video })

    setLocalStream(stream)
    return svc
  }, [cleanupCall])

  // ── Signaling message handler ───────────────────────────────────────────

  const handleSignalingMessage = useCallback((payload: SignalingPayload) => {
    const store = useCallStore.getState()

    switch (payload.event) {
      case 'call-answer':
        logger.info('Received call answer')
        store.setConnecting()
        webrtcRef.current?.handleAnswer(payload.answer).catch((err) => {
          logger.error('Failed to handle answer:', err)
          store.endCall('Failed to connect')
          cleanupCall()
        })
        break

      case 'ice-candidate':
        webrtcRef.current?.addIceCandidate(payload.candidate).catch(() => {})
        break

      case 'call-hangup':
        logger.info('Peer hung up')
        store.endCall('Peer hung up')
        cleanupCall()
        break

      case 'call-decline':
        logger.info('Peer declined')
        store.endCall('Call declined')
        cleanupCall()
        break

      default:
        break
    }
  }, [cleanupCall])

  // ── Listen for incoming calls (always on when authenticated) ────────────

  useEffect(() => {
    if (!userId) return

    const cleanup = listenForIncomingCalls(userId, (offerPayload) => {
      const store = useCallStore.getState()

      // Ignore if already in a call
      if (store.status !== 'idle') {
        logger.warn('Ignoring incoming call — already in a call')
        return
      }

      logger.info('Incoming call from', offerPayload.callerName)
      pendingOfferRef.current = offerPayload

      store.startRinging('incoming', {
        userId: offerPayload.callerId,
        displayName: offerPayload.callerName,
      }, offerPayload.callMode ?? 'audio')

      // Auto-decline after timeout
      ringTimeoutRef.current = setTimeout(() => {
        const current = useCallStore.getState()
        if (current.status === 'ringing' && current.direction === 'incoming') {
          // Join the pairwise channel briefly to send decline
          const sig = createCallSignaling(offerPayload.pairwiseChannel)
          sig.join(() => {})
          setTimeout(() => {
            sig.sendDecline()
            setTimeout(() => sig.leave(), 500)
          }, 500)
          current.endCall('No answer')
          cleanupCall()
        }
      }, RING_TIMEOUT_MS)
    })

    return cleanup
  }, [userId, cleanupCall])

  // ── Sync mute state to WebRTC ───────────────────────────────────────────

  const isMuted = useCallStore((s) => s.isMuted)
  useEffect(() => {
    webrtcRef.current?.setMuted(isMuted)
  }, [isMuted])

  const isVideoOff = useCallStore((s) => s.isVideoOff)
  useEffect(() => {
    webrtcRef.current?.setVideoEnabled(!isVideoOff)
  }, [isVideoOff])

  // ── Actions ─────────────────────────────────────────────────────────────

  const startCallInternal = useCallback((peer: CallPeer, mode: CallMode) => {
    if (!userId) return
    const store = useCallStore.getState()
    if (store.status !== 'idle') {
      logger.warn('Cannot start call — already in a call')
      return
    }

    const video = mode === 'video'
    const pairwiseChannel = buildChannelName(userId, peer.userId)

    store.startRinging('outgoing', peer, mode)

    // Join pairwise channel first so we can receive answer/ICE
    const sig = createCallSignaling(pairwiseChannel)
    signalingRef.current = sig
    sig.join(handleSignalingMessage)

    // Init WebRTC, create offer, send to peer (with ephemeral key for encryption)
    initWebRTC(video).then(async (svc) => {
      const offer = await svc.createOffer()
      const ephemeralKey = await sig.getEphemeralKey()
      await sendCallOffer(userId, callerNameRef.current, peer.userId, offer, pairwiseChannel, ephemeralKey, mode)
      logger.info('Outgoing call started to', peer.displayName)

      // Ring timeout
      ringTimeoutRef.current = setTimeout(() => {
        const current = useCallStore.getState()
        if (current.status === 'ringing' && current.direction === 'outgoing') {
          current.endCall('No answer')
          cleanupCall()
        }
      }, RING_TIMEOUT_MS)
    }).catch((err) => {
      logger.error('Failed to start call:', err)
      store.endCall(video ? 'Camera/microphone access denied' : 'Microphone access denied')
      cleanupCall()
    })
  }, [userId, initWebRTC, handleSignalingMessage, cleanupCall])

  const startCall = useCallback((peer: CallPeer) => {
    startCallInternal(peer, 'audio')
  }, [startCallInternal])

  const startVideoCall = useCallback((peer: CallPeer) => {
    startCallInternal(peer, 'video')
  }, [startCallInternal])

  const acceptCall = useCallback(() => {
    const offer = pendingOfferRef.current
    if (!offer) {
      logger.warn('No pending offer to accept')
      return
    }

    const video = (offer.callMode ?? 'audio') === 'video'

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }

    useCallStore.getState().setConnecting()

    // Join pairwise channel
    const sig = createCallSignaling(offer.pairwiseChannel)
    signalingRef.current = sig
    // Set caller's ephemeral key for signaling encryption
    if (offer.ephemeralKey) {
      sig.setPeerEphemeralKey(offer.ephemeralKey)
    }
    sig.join(handleSignalingMessage)

    // Init WebRTC, handle the offer, send answer (with our ephemeral key)
    initWebRTC(video).then(async (svc) => {
      const answer = await svc.handleOffer(offer.offer)
      sig.sendAnswer(answer)
      pendingOfferRef.current = null
      logger.info('Call accepted')
    }).catch((err) => {
      logger.error('Failed to accept call:', err)
      useCallStore.getState().endCall(video ? 'Camera/microphone access denied' : 'Microphone access denied')
      cleanupCall()
    })
  }, [initWebRTC, handleSignalingMessage, cleanupCall])

  const declineCall = useCallback(() => {
    const offer = pendingOfferRef.current
    if (offer) {
      // Join pairwise channel briefly to send decline
      const sig = createCallSignaling(offer.pairwiseChannel)
      sig.join(() => {})
      setTimeout(() => {
        sig.sendDecline()
        setTimeout(() => sig.leave(), 500)
      }, 500)
    }
    useCallStore.getState().endCall('Call declined')
    cleanupCall()
  }, [cleanupCall])

  const hangUp = useCallback(() => {
    signalingRef.current?.sendHangup()
    useCallStore.getState().endCall('Call ended')
    cleanupCall()
  }, [cleanupCall])

  const toggleMute = useCallback(() => {
    useCallStore.getState().toggleMute()
  }, [])

  const toggleVideo = useCallback(() => {
    useCallStore.getState().toggleVideo()
  }, [])

  return { startCall, startVideoCall, acceptCall, declineCall, hangUp, toggleMute, toggleVideo, localStream, remoteStream }
}
