import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, X, RefreshCw, ShieldCheck, Send } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  openOutsideEntity,
  pollOutsideEntity,
  postOutsideEntityMessage,
  type OutsideEntityMessage,
} from '../../lib/outsideEntityAnonService'
import { unwrapOutsidePriv } from '../../lib/outsideEntityKey'
import { sealPair, openAsOutside } from '../../lib/outsideEntitySeal'
import { Shell, Glitch404 } from './IntakeForm'

interface OutsideInviteViewProps {
  supabase: SupabaseClient
  /** Raw invite token from `?i=` (server stores sha256(token) as token_hash). */
  token: string
  /** fragment_secret from `#k=` — half of the wrap key W=HKDF(fragment, code). */
  fragment: string
}

interface RenderedMsg {
  id: string
  mine: boolean
  text: string
  at: string
}

const POLL_MS = 3000

/**
 * Outbound OUTSIDE-ENTITY surface (anon/public bundle) — the recipient's end of a
 * medic-initiated, email-delivered 1:1. Distinct from OutsideSessionView (the
 * inbound, ephemeral, key-dies-on-reload lane): here the private key is UNWRAPPED
 * in-heap from the server blob using the emailed code + the URL `#k=` fragment, so
 * the same channel re-opens across reloads for the 24h window.
 *
 * Zero IndexedDB/localStorage/sessionStorage writes — the key lives in a ref and
 * is re-derived (not stored) on each open. Imports NOTHING from src/lib/signal/*
 * (bundle firewall). Every message is dual-sealed { m, o }; this side reads `.o`.
 * On expiry/revoke (open or poll) it renders the shared 404/expired surface inside
 * intake.html (no public/404.html exists — never depends on gh-pages routing).
 */
export function OutsideInviteView({ supabase, token, fragment }: OutsideInviteViewProps) {
  const [phase, setPhase] = useState<'prompt' | 'opening' | 'active' | 'expired'>('prompt')
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [fromLabel, setFromLabel] = useState('Medical section')
  const [msgs, setMsgs] = useState<RenderedMsg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const privRef = useRef<CryptoKey | null>(null)
  const medicPubRef = useRef<string>('')
  const outsidePubRef = useRef<string>('')
  const entityIdRef = useRef<string>('')
  const lastSeenRef = useRef<string | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endedRef = useRef(false)

  const teardown = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  // Decrypt a batch of stored rows with the in-heap key; drop anything that fails
  // auth (tamper / not sealed to us). dir tags the bubble side.
  const decryptRows = useCallback(async (rows: OutsideEntityMessage[]): Promise<RenderedMsg[]> => {
    const key = privRef.current
    if (!key) return []
    const out: RenderedMsg[] = []
    for (const r of rows) {
      try {
        const text = await openAsOutside(key, r.sealed)
        out.push({ id: r.id, mine: r.dir === 'to_medic', text, at: r.created_at })
      } catch { /* undecryptable — drop */ }
    }
    return out
  }, [])

  const bumpLastSeen = useCallback((rows: { created_at: string }[]) => {
    for (const r of rows) {
      if (!lastSeenRef.current || r.created_at > lastSeenRef.current) lastSeenRef.current = r.created_at
    }
  }, [])

  const onPoll = useCallback(async () => {
    const id = entityIdRef.current
    if (!id || endedRef.current) return
    const res = await pollOutsideEntity(supabase, id, lastSeenRef.current)
    if (!res) return // transient — keep polling
    if (!res.active) {
      endedRef.current = true
      teardown()
      setPhase('expired')
      return
    }
    const pending = res.messages ?? []
    if (pending.length === 0) return
    bumpLastSeen(pending)
    const fresh = await decryptRows(pending)
    if (fresh.length) {
      setMsgs((prev) => {
        const have = new Set(prev.map((p) => p.id))
        const add = fresh.filter((f) => !have.has(f.id))
        return add.length ? [...prev, ...add] : prev
      })
    }
  }, [supabase, teardown, decryptRows, bumpLastSeen])

  const onOpen = useCallback(async () => {
    if (code.trim().length === 0 || phase === 'opening') return
    setHint(null)
    setPhase('opening')
    const res = await openOutsideEntity(supabase, token, code.trim())
    if (!res.ok) {
      if (res.expired) { setPhase('expired'); return }
      if (res.locked) {
        setHint('Too many attempts. Wait a few minutes and try again.')
      } else {
        setHint('That code didn’t match. Check the code from your email and try again.')
      }
      setPhase('prompt')
      return
    }
    // Unwrap the private key with (fragment, code). A wrong fragment (mangled link)
    // fails here even though the code was accepted server-side — treat as invalid.
    let priv: CryptoKey
    try {
      priv = await unwrapOutsidePriv(res.data.wrapped_outside_priv, fragment, code.trim())
    } catch {
      setHint('This link appears to be incomplete or corrupted. Open the full link from your email.')
      setPhase('prompt')
      return
    }
    privRef.current = priv
    medicPubRef.current = res.data.medic_pub
    outsidePubRef.current = res.data.outside_pub
    entityIdRef.current = res.data.entity_id
    setFromLabel(res.data.from_label || 'Medical section')
    bumpLastSeen(res.data.messages)
    const rendered = await decryptRows(res.data.messages)
    setMsgs(rendered)
    setPhase('active')
    pollTimerRef.current = setInterval(() => { void onPoll() }, POLL_MS)
  }, [code, phase, supabase, token, fragment, bumpLastSeen, decryptRows, onPoll])

  const onSend = useCallback(async () => {
    const body = draft.trim()
    if (body.length === 0 || sending || !privRef.current) return
    setSending(true)
    const pair = await sealPair(body, medicPubRef.current, outsidePubRef.current)
    const ok = await postOutsideEntityMessage(supabase, entityIdRef.current, pair)
    setSending(false)
    if (!ok) {
      setHint('Message could not be sent. The link may have expired.')
      return
    }
    // Optimistic append — the poll only drains medic→outside rows, never our own.
    setMsgs((prev) => [
      ...prev,
      { id: `local-${prev.length}-${body.length}`, mine: true, text: body, at: '' },
    ])
    setDraft('')
  }, [draft, sending, supabase])

  useEffect(() => teardown, [teardown])

  // Bad/empty link — nothing to open.
  if (!token || !fragment) {
    return <Shell><Glitch404 /></Shell>
  }

  if (phase === 'expired') {
    return (
      <Shell>
        <Glitch404 />
        <p className="mt-4 text-[10pt] text-center text-secondary leading-relaxed max-w-xs mx-auto">
          This secure message has expired or been closed.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <Branding />

      {phase === 'active' ? (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Secure message</p>
          </div>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-primary/6 bg-themewhite/30 flex items-center gap-2.5">
              <ShieldCheck size={15} className="text-themeblue2 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary truncate">{fromLabel}</p>
                <p className="text-[9pt] text-tertiary truncate">End-to-end encrypted</p>
              </div>
            </div>

            {/* Thread */}
            <div className="px-4 py-3 max-h-[45vh] overflow-y-auto">
              {msgs.length === 0 ? (
                <p className="text-[10pt] text-tertiary leading-relaxed">
                  No messages yet. Anything you send here is private to you and {fromLabel}.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${m.mine ? 'bg-themeblue3 text-white' : 'bg-themewhite text-primary'}`}>
                        {!m.mine && (
                          <p className="text-[9pt] text-tertiary uppercase tracking-widest mb-0.5">{fromLabel}</p>
                        )}
                        <p className="text-[11pt] leading-snug whitespace-pre-wrap break-words">{m.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-primary/6">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message *"
                rows={3}
                maxLength={2000}
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
              />
              <div className="flex items-center justify-end gap-2 px-3 py-2">
                {(() => {
                  const ready = draft.trim().length > 0
                  return (
                    <button
                      type="button"
                      onClick={() => void onSend()}
                      disabled={sending || !ready}
                      className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${ready ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                    >
                      {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  )
                })()}
              </div>
            </div>
          </div>
          {hint && <p className="mt-3 text-[10pt] text-center text-themeredred leading-relaxed">{hint}</p>}
        </>
      ) : (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Enter code</p>
          </div>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10pt] text-secondary leading-relaxed">
                You’ve received a secure message. Enter the code from your email to open it.
              </p>
            </div>
            <label className="block border-b border-primary/6">
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setHint(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') void onOpen() }}
                placeholder="Code *"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none font-mono tracking-widest"
              />
            </label>
            {hint && (
              <div className="px-4 py-2 text-[10pt] leading-relaxed border-b border-primary/6 text-themeredred">
                {hint}
              </div>
            )}
            <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${code.trim().length > 0 ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
              <button
                type="button"
                onClick={() => setCode('')}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
              <button
                type="button"
                onClick={() => void onOpen()}
                disabled={phase === 'opening'}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
              >
                {phase === 'opening' ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
              </button>
            </div>
          </div>
        </>
      )}

      <p className="mt-6 text-[10pt] text-center text-secondary leading-relaxed max-w-xs mx-auto">
        Not affiliated with or endorsed by the Department of Defense.
      </p>
    </Shell>
  )
}

function Branding() {
  return (
    <div className="text-center mb-8">
      <div className="relative mx-auto mb-2 w-17 h-17">
        <svg className="relative w-full h-full" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(20,20)">
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(60)" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(120)" />
          </g>
        </svg>
      </div>
      <div className="text-[10pt] text-secondary">
        Medical Knowledge Repository and Operational Network
      </div>
    </div>
  )
}
