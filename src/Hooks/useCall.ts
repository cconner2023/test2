/**
 * useCall — Orchestration hook for WebRTC calls (audio & video).
 *
 * Mounted once via CallProvider. Manages the full call lifecycle:
 * signaling, WebRTC setup, media playback, and cleanup.
 *
 * Signaling rides the SIGNAL MESSAGE TRANSPORT (message_type='call-signal'),
 * not an open Realtime side-channel. The Signal session is the authorization
 * gate — a call can only be placed to a peer we can establish a session with.
 * Outgoing signals go via useMessagesContext().sendCallSignal; incoming signals
 * arrive (decrypted) on the callSignalBus, fed by useSignalMessages.decryptRow.
 * Media (DTLS-SRTP) is unchanged.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { useCallStore } from '../stores/useCallStore'
import { useMessagesContext } from './MessagesContext'
import { createWebRTCService, type WebRTCService } from '../lib/webrtc/webrtcService'
import { onCallSignal, type IncomingCallSignal, type CallSignalBody } from '../lib/webrtc/callSignalBus'
import { RING_TIMEOUT_MS } from '../lib/webrtc/types'
import type { CallMode, CallPeer } from '../lib/webrtc/types'
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

  const messages = useMessagesContext()
  // Stable ref to the send fn so callbacks/subscriptions don't re-bind on every render.
  const sendCallSignalRef = useRef(messages?.sendCallSignal ?? null)
  useEffect(() => {
    sendCallSignalRef.current = messages?.sendCallSignal ?? null
  }, [messages?.sendCallSignal])

  const webrtcRef = useRef<WebRTCService | null>(null)
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingOfferRef = useRef<IncomingCallSignal | null>(null)
  /** The active call's id — scopes incoming signals; stale-call signals are ignored. */
  const activeCallIdRef = useRef<string | null>(null)
  /** The peer userId we address outgoing signals to. */
  const peerIdRef = useRef<string | null>(null)
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

  // ── Outgoing signal helper ────────────────────────────────────────────────

  const emit = useCallback((peerId: string, body: CallSignalBody) => {
    const send = sendCallSignalRef.current
    if (!send) {
      logger.warn('Cannot send call signal — messaging not ready')
      return
    }
    send(peerId, body).catch((err) => logger.warn('Call signal send failed:', err))
  }, [])

  // ── Cleanup helper ──────────────────────────────────────────────────────

  const cleanupCall = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
    webrtcRef.current?.cleanup()
    webrtcRef.current = null
    pendingOfferRef.current = null
    peerIdRef.current = null
    activeCallIdRef.current = null
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
        const pid = peerIdRef.current
        const cid = activeCallIdRef.current
        if (pid && cid) emit(pid, { callId: cid, k: 'ice', cand: candidate })
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
  }, [cleanupCall, emit])

  // ── Incoming signal subscription (always on when authenticated) ───────────

  useEffect(() => {
    if (!userId) return

    const unsub = onCallSignal((sig) => {
      const store = useCallStore.getState()

      // A fresh offer = an incoming call.
      if (sig.k === 'offer') {
        if (store.status !== 'idle') {
          logger.warn('Ignoring incoming call — already in a call')
          return
        }
        logger.info('Incoming call from', sig.callerName)
        activeCallIdRef.current = sig.callId
        peerIdRef.current = sig.senderId
        pendingOfferRef.current = sig

        store.startRinging('incoming', {
          userId: sig.senderId,
          displayName: sig.callerName ?? 'Unknown',
        }, sig.mode ?? 'audio')

        // Auto-decline after timeout
        ringTimeoutRef.current = setTimeout(() => {
          const current = useCallStore.getState()
          if (current.status === 'ringing' && current.direction === 'incoming') {
            emit(sig.senderId, { callId: sig.callId, k: 'decline' })
            current.endCall('No answer')
            cleanupCall()
          }
        }, RING_TIMEOUT_MS)
        return
      }

      // Everything else must match the active call (ignore stale/replayed rows).
      if (!activeCallIdRef.current || sig.callId !== activeCallIdRef.current) return

      switch (sig.k) {
        case 'answer':
          if (!sig.sdp) break
          logger.info('Received call answer')
          store.setConnecting()
          webrtcRef.current?.handleAnswer(sig.sdp).catch((err) => {
            logger.error('Failed to handle answer:', err)
            store.endCall('Failed to connect')
            cleanupCall()
          })
          break

        case 'ice':
          if (sig.cand) webrtcRef.current?.addIceCandidate(sig.cand).catch(() => {})
          break

        case 'hangup':
          logger.info('Peer hung up')
          store.endCall('Peer hung up')
          cleanupCall()
          break

        case 'decline':
          logger.info('Peer declined')
          store.endCall('Call declined')
          cleanupCall()
          break

        default:
          break
      }
    })

    return unsub
  }, [userId, cleanupCall, emit])

  // ── Sync mute / video state to WebRTC ─────────────────────────────────────

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
    if (!sendCallSignalRef.current) {
      logger.warn('Cannot start call — messaging not ready')
      return
    }
    const store = useCallStore.getState()
    if (store.status !== 'idle') {
      logger.warn('Cannot start call — already in a call')
      return
    }

    const video = mode === 'video'
    const callId = crypto.randomUUID()
    activeCallIdRef.current = callId
    peerIdRef.current = peer.userId

    store.startRinging('outgoing', peer, mode)

    // Init WebRTC, create offer, send to peer over the Signal session.
    initWebRTC(video).then(async (svc) => {
      const offer = await svc.createOffer()
      emit(peer.userId, { callId, k: 'offer', sdp: offer, mode, callerName: callerNameRef.current })
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
  }, [userId, initWebRTC, cleanupCall, emit])

  const startCall = useCallback((peer: CallPeer) => {
    startCallInternal(peer, 'audio')
  }, [startCallInternal])

  const startVideoCall = useCallback((peer: CallPeer) => {
    startCallInternal(peer, 'video')
  }, [startCallInternal])

  const acceptCall = useCallback(() => {
    const offer = pendingOfferRef.current
    if (!offer || !offer.sdp) {
      logger.warn('No pending offer to accept')
      return
    }

    const video = (offer.mode ?? 'audio') === 'video'
    const offerSdp = offer.sdp

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }

    useCallStore.getState().setConnecting()

    // peerIdRef + activeCallIdRef were set when the offer arrived.
    initWebRTC(video).then(async (svc) => {
      const answer = await svc.handleOffer(offerSdp)
      emit(offer.senderId, { callId: offer.callId, k: 'answer', sdp: answer })
      pendingOfferRef.current = null
      logger.info('Call accepted')
    }).catch((err) => {
      logger.error('Failed to accept call:', err)
      useCallStore.getState().endCall(video ? 'Camera/microphone access denied' : 'Microphone access denied')
      cleanupCall()
    })
  }, [initWebRTC, cleanupCall, emit])

  const declineCall = useCallback(() => {
    const offer = pendingOfferRef.current
    if (offer) {
      emit(offer.senderId, { callId: offer.callId, k: 'decline' })
    }
    useCallStore.getState().endCall('Call declined')
    cleanupCall()
  }, [cleanupCall, emit])

  const hangUp = useCallback(() => {
    const pid = peerIdRef.current
    const cid = activeCallIdRef.current
    if (pid && cid) emit(pid, { callId: cid, k: 'hangup' })
    useCallStore.getState().endCall('Call ended')
    cleanupCall()
  }, [cleanupCall, emit])

  const toggleMute = useCallback(() => {
    useCallStore.getState().toggleMute()
  }, [])

  const toggleVideo = useCallback(() => {
    useCallStore.getState().toggleVideo()
  }, [])

  return { startCall, startVideoCall, acceptCall, declineCall, hangUp, toggleMute, toggleVideo, localStream, remoteStream }
}
