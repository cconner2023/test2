import { useState, useEffect, useCallback, useRef } from 'react'
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js'
import { supabase } from '../lib/supabase'
import { generateHandoffKeypair, openHandoffSealed, sealToHandoffPub, type HandoffSealed } from '../lib/deviceHandoffSeal'
import { downloadAndApplyHandoff, prepareAndUploadHandoff } from '../lib/deviceHandoff'
import { holdLinkExchange, resolveForeignLink, releaseLinkGate } from '../lib/authLinkGate'
import { loadLocalSessionSync } from '../stores/useAuthStore'

export type LinkeeStatus = 'waiting' | 'receiving' | 'error'
export type ChannelState = 'connecting' | 'ready' | 'error'

/**
 * Used by the new device at the LoginScreen (QR mode).
 * Generates a one-time channelId, subscribes to Realtime, and applies
 * received session credentials automatically.
 *
 * channelState reflects the Realtime subscription status so the UI can
 * show a "connected" indicator and surface errors (e.g. unauthenticated
 * Realtime rejection, network failure).
 */
export function useLinkeeChannel() {
  const [channelId, setChannelId] = useState(() => crypto.randomUUID())
  const [status, setStatus] = useState<LinkeeStatus>('waiting')
  const [error, setError] = useState<string | null>(null)
  const [channelState, setChannelState] = useState<ChannelState>('connecting')
  // Per-handoff ephemeral keypair (Option A): public half is encoded into the QR so
  // the linker can seal the vault+history bundle to it; the private half stays here
  // in a ref and never leaves this device.
  const [handoffPublicKey, setHandoffPublicKey] = useState<string | null>(null)
  const handoffPrivateKeyRef = useRef<CryptoKey | null>(null)

  const regenerate = useCallback(() => {
    setChannelId(crypto.randomUUID())
    setStatus('waiting')
    setError(null)
    setChannelState('connecting')
    setHandoffPublicKey(null)
    handoffPrivateKeyRef.current = null
  }, [])

  // Mint the handoff keypair whenever the channelId changes. The QR waits for the
  // public key before rendering so the linker always has a seal target.
  useEffect(() => {
    let cancelled = false
    setHandoffPublicKey(null)
    handoffPrivateKeyRef.current = null
    generateHandoffKeypair()
      .then((kp) => {
        if (cancelled) return
        handoffPrivateKeyRef.current = kp.privateKey
        setHandoffPublicKey(kp.publicKeyB64)
      })
      .catch(() => { /* handoff unavailable — QR still links the session */ })
    return () => { cancelled = true }
  }, [channelId])

  useEffect(() => {
    setChannelState('connecting')
    const channel = supabase.channel(`device-link:${channelId}`)

    channel
      .on('broadcast', { event: 'credentials' }, async ({ payload }) => {
        // device-link:* is a public Realtime channel (the linkee has no session yet, so
        // it can't join a private one), and anyone who sees the QR knows the topic. The
        // tokens therefore arrive sealed to this device's QR key; plaintext payloads are
        // ignored so a listener can't read them and a third party can't push its own.
        const priv = handoffPrivateKeyRef.current
        const sealed = (payload as { sealed?: HandoffSealed } | null)?.sealed
        if (!priv || !sealed) return
        let creds: { access_token: string; refresh_token: string }
        try {
          creds = JSON.parse(await openHandoffSealed(priv, sealed))
        } catch {
          return
        }
        setStatus('receiving')
        // Same hazard as the auth-email links: these credentials may belong to a
        // different account than the one this browser already holds, and setSession
        // fires SIGNED_IN before we can compare. Hold first, sort it out after.
        const incumbent = loadLocalSessionSync()
        if (incumbent) {
          const { data: prior } = await supabase.auth.getSession()
          holdLinkExchange(
            { userId: incumbent.userId, email: incumbent.email },
            prior.session
              ? { access_token: prior.session.access_token, refresh_token: prior.session.refresh_token }
              : null,
          )
        }
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: creds.access_token,
          refresh_token: creds.refresh_token,
        })
        if (sessionError) {
          if (incumbent) releaseLinkGate()
          setStatus('error')
          setError(sessionError.message)
          return
        }
        if (incumbent) {
          if (sessionData?.user && sessionData.user.id !== incumbent.userId) {
            // ForeignLinkSwitchScreen owns it now. The handoff bundle is skipped:
            // it is sealed to this device and history transfer is best-effort, so
            // losing it costs a convenience, not the link.
            resolveForeignLink({
              userId: sessionData.user.id,
              email: sessionData.user.email ?? '',
              kind: 'magiclink',
            })
            return
          }
          releaseLinkGate()
        }
        // Device-handoff (Option A): now authenticated, pull the sealed vault+history
        // bundle the linker uploaded and apply it (history → IDB; vault plaintext is
        // stashed for a later set-password). Fire-and-forget — best-effort, the link
        // succeeds regardless. On success Supabase onAuthStateChange navigates away.
        const uid = sessionData?.user?.id
        if (uid) {
          void downloadAndApplyHandoff(uid, channelId, priv)
        }
      })
      .subscribe((subStatus, err) => {
        if (subStatus === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          setChannelState('ready')
        } else if (
          subStatus === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          subStatus === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
        ) {
          setChannelState('error')
          setStatus('error')
          setError(err?.message ?? 'Connection failed — tap to try again')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  return { channelId, status, error, channelState, regenerate, handoffPublicKey }
}

/**
 * Used by the primary device in the Linked Devices panel.
 * Joins the linkee's channel and broadcasts the current session credentials.
 */
export function useLinkerBroadcast() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)

  const broadcast = useCallback(async (channelId: string, linkeePubB64?: string) => {
    setSending(true)
    setSent(false)
    setBroadcastError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSending(false)
      setBroadcastError('No active session')
      return
    }
    // The tokens are sealed to the QR key (see useLinkeeChannel); without it there is
    // nothing safe to send over the public channel.
    if (!linkeePubB64) {
      setSending(false)
      setBroadcastError('This code is out of date. Ask the other device to show a new one.')
      return
    }
    let sealedCreds: HandoffSealed
    try {
      sealedCreds = await sealToHandoffPub(
        linkeePubB64,
        JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
      )
    } catch {
      setSending(false)
      setBroadcastError('This code could not be read. Ask the other device to show a new one.')
      return
    }

    // Device-handoff (Option A): seal this device's vault + history to the new
    // device's QR public key and upload it BEFORE handing over the session, so it's
    // already waiting when the linkee downloads. Best-effort — a failure just means
    // the new device links session-only (no history/vault carryover), as before.
    if (session.user?.id) {
      await prepareAndUploadHandoff(session.user.id, channelId, linkeePubB64).catch(() => null)
    }

    await new Promise<void>((resolve) => {
      const channel = supabase.channel(`device-link:${channelId}`)

      channel.subscribe(async (status) => {
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) return

        const sendResult = await channel.send({
          type: 'broadcast',
          event: 'credentials',
          payload: { sealed: sealedCreds },
        })

        await supabase.removeChannel(channel)

        if (sendResult === 'ok') {
          setSent(true)
        } else {
          setBroadcastError('Failed to send. Is the other device still waiting?')
        }
        setSending(false)
        resolve()
      })
    })
  }, [])

  return { broadcast, sending, sent, broadcastError }
}
