import { useState, useEffect, useRef, useCallback } from 'react'
import { X, RefreshCw, Radio } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateOutsideSessionKeypair,
  registerOutsideSession,
  pollOutsideSession,
  ackOutsideSessionReplies,
  endOutsideSession,
  type OutsideSessionReply,
} from '../../lib/outsideSessionAnonService'
import { openSealed, type SealedPayload } from '../../lib/outsideSeal'

interface OutsideSessionViewProps {
  supabase: SupabaseClient
  passcode: string
  /** Already validated by the preceding terminal action (message/call submit). */
  passphrase: string
  requesterName: string
  clinicName: string
  /** Fired when the session ends (explicit / server-ended) so the parent can reset. */
  onEnd: () => void
}

/** A cluster→outside text reply rendered as a bubble. (Decryption wired in slice 4.) */
interface RenderedReply {
  id: string
  fromName: string
  text: string
  at: string
}

const POLL_MS = 3000

/**
 * Post-submit OUTSIDE-SESSION surface (anon/public bundle). Mounted after a
 * successful Message (or, later, Call) submission — so the passphrase is already
 * known-good and register's own bcrypt always passes (no pre-submit oracle).
 *
 * Holds the ephemeral ECDH keypair in the tab heap only (never persisted), polls
 * for cluster replies + incoming ring-back, and ends the session on tab close.
 * Imports NOTHING from src/lib/signal/* (bundle firewall) — the outside party
 * holds its private key directly, so no vault unwrap is needed anon-side.
 *
 * Slice 3 proves the lifecycle (open card on cluster → close on tab close).
 * Reply DECRYPTION + the incoming-ring banner land in slices 4/5.
 */
export function OutsideSessionView({
  supabase,
  passcode,
  passphrase,
  requesterName,
  clinicName,
  onEnd,
}: OutsideSessionViewProps) {
  const [phase, setPhase] = useState<'registering' | 'active' | 'ended' | 'failed'>('registering')
  const [replies, setReplies] = useState<RenderedReply[]>([])

  const sessionIdRef = useRef<string | null>(null)
  const privateKeyRef = useRef<CryptoKey | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endedRef = useRef(false)

  const teardown = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const finish = useCallback((reason: 'ended' | 'failed') => {
    if (endedRef.current) return
    endedRef.current = true
    teardown()
    const sid = sessionIdRef.current
    // Best-effort explicit close so the cluster card flips to "Ended" promptly;
    // the 5-min staleness sweep is the real backstop if this never lands.
    if (sid) void endOutsideSession(supabase, sid).catch(() => {})
    setPhase(reason)
  }, [supabase, teardown])

  // Process one poll: handle session-end, render/ack any pending replies.
  const onPoll = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid || endedRef.current) return
    const res = await pollOutsideSession(supabase, sid)
    if (!res) return // transient transport error — keep polling
    if (!res.active) {
      endedRef.current = true // server already finalized; don't re-call end
      teardown()
      setPhase('ended')
      return
    }
    const pending: OutsideSessionReply[] = res.replies ?? []
    if (pending.length === 0) return

    // Decrypt sealed text replies with the in-heap private key; drop anything
    // that fails auth (tamper / wrong key). Ring-back signals ('...-call-*')
    // route to the call layer in slice 5 — for now they're acked + dropped.
    const ackIds: string[] = []
    const fresh: RenderedReply[] = []
    const key = privateKeyRef.current
    for (const r of pending) {
      ackIds.push(r.reply_id)
      if (r.kind === 'outside-session-inbox-text' && r.sealed && key) {
        try {
          const text = await openSealed(key, r.sealed as SealedPayload)
          fresh.push({ id: r.reply_id, fromName: r.from_name ?? 'Medical section', text, at: r.created_at })
        } catch { /* undecryptable — drop */ }
      }
    }
    if (fresh.length) {
      setReplies((prev) => {
        const have = new Set(prev.map((p) => p.id))
        const add = fresh.filter((f) => !have.has(f.id))
        return add.length ? [...prev, ...add] : prev
      })
    }
    void ackOutsideSessionReplies(supabase, sid, ackIds).catch(() => {})
  }, [supabase, teardown])

  // Register on mount, then start the poll loop.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const kp = await generateOutsideSessionKeypair()
      if (cancelled) return
      privateKeyRef.current = kp.privateKey
      const res = await registerOutsideSession(supabase, passcode, passphrase, kp.publicKeyB64, requesterName)
      if (cancelled) return
      if (!res.ok) {
        setPhase('failed')
        return
      }
      sessionIdRef.current = res.data.session_id
      setPhase('active')
      pollTimerRef.current = setInterval(() => { void onPoll() }, POLL_MS)
    })()

    return () => {
      cancelled = true
      finish('ended')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab close / hide: end the session (best-effort; sweep is the backstop).
  useEffect(() => {
    const end = () => finish('ended')
    window.addEventListener('beforeunload', end)
    return () => window.removeEventListener('beforeunload', end)
  }, [finish])

  if (phase === 'failed') {
    return (
      <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
        <p className="text-sm font-medium text-primary mb-1.5">Reply lane unavailable</p>
        <p className="text-[10pt] text-secondary leading-relaxed">
          Your message was delivered. A live reply session could not be opened — the medical
          section will follow up through the contact details you provided.
        </p>
        <div className="flex items-center justify-end pt-3">
          <button
            type="button"
            onClick={onEnd}
            className="shrink-0 h-9 px-4 rounded-full flex items-center justify-center bg-themeblue3 text-white text-[10pt] active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'ended') {
    return (
      <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
        <p className="text-sm font-medium text-primary mb-1.5">Session ended</p>
        <p className="text-[10pt] text-secondary leading-relaxed">
          The reply session with {clinicName || 'the medical section'} has closed.
        </p>
        <div className="flex items-center justify-end pt-3">
          <button
            type="button"
            onClick={onEnd}
            className="shrink-0 h-9 px-4 rounded-full flex items-center justify-center bg-themeblue3 text-white text-[10pt] active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pb-2">
        <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Reply session</p>
      </div>

      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        {/* Status header */}
        <div className="px-4 py-3 border-b border-primary/6 bg-themewhite/30 flex items-center gap-2.5">
          {phase === 'registering' ? (
            <RefreshCw size={14} className="text-tertiary animate-spin shrink-0" />
          ) : (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-themegreen opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-themegreen" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary truncate">
              {phase === 'registering' ? 'Opening reply session…' : 'Session active'}
            </p>
            <p className="text-[9pt] text-tertiary truncate">
              {clinicName ? `${clinicName} can reply or call back` : 'The medical section can reply or call back'}
            </p>
          </div>
        </div>

        {/* Reply list (decryption wired in slice 4) */}
        <div className="px-4 py-3">
          {replies.length === 0 ? (
            <p className="text-[10pt] text-tertiary leading-relaxed flex items-center gap-2">
              <Radio size={13} className="shrink-0" />
              Keep this page open to receive a reply or a call back.
            </p>
          ) : (
            <div className="space-y-2.5">
              {replies.map((r) => (
                <div key={r.id} className="rounded-xl bg-themewhite px-3 py-2">
                  <p className="text-[9pt] text-tertiary uppercase tracking-widest mb-0.5">{r.fromName}</p>
                  <p className="text-[11pt] text-primary leading-snug whitespace-pre-wrap break-words">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 text-[10pt] leading-relaxed border-t border-primary/6 text-themeyellow">
          Operational details only — no patient names or medical details.
        </div>

        {/* End session */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-primary/6">
          <button
            type="button"
            onClick={() => finish('ended')}
            className="shrink-0 h-9 px-4 rounded-full flex items-center gap-1.5 text-themeredred text-[10pt] active:scale-95 transition-all"
          >
            <X size={14} /> End session
          </button>
        </div>
      </div>
    </>
  )
}
