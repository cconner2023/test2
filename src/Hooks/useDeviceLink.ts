import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type LinkeeStatus = 'waiting' | 'receiving' | 'error'

/**
 * Used by the new device at the LoginScreen (QR mode).
 * Generates a one-time channelId, subscribes to Realtime, and applies
 * received session credentials automatically.
 */
export function useLinkeeChannel() {
  const [channelId] = useState(() => crypto.randomUUID())
  const [status, setStatus] = useState<LinkeeStatus>('waiting')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const channel = supabase.channel(`device-link:${channelId}`)

    channel
      .on('broadcast', { event: 'credentials' }, async ({ payload }) => {
        setStatus('receiving')
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        })
        if (sessionError) {
          setStatus('error')
          setError(sessionError.message)
        }
        // On success Supabase onAuthStateChange fires → app navigates away
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  return { channelId, status, error }
}

/**
 * Used by the primary device in the Linked Devices panel.
 * Joins the linkee's channel and broadcasts the current session credentials.
 */
export function useLinkerBroadcast() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)

  const broadcast = useCallback(async (channelId: string) => {
    setSending(true)
    setSent(false)
    setBroadcastError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSending(false)
      setBroadcastError('No active session')
      return
    }

    await new Promise<void>((resolve) => {
      const channel = supabase.channel(`device-link:${channelId}`)

      channel.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return

        const sendResult = await channel.send({
          type: 'broadcast',
          event: 'credentials',
          payload: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
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
