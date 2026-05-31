import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Check, RefreshCw, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { startRecording } from '../../Utilities/voiceUtils'
import { base64ToBytes, bytesToBase64 } from '../../lib/base64Utils'
import { aesGcmEncrypt } from '../../lib/aesGcm'
import { submitOncallVoicemail, type OncallGreetingWire } from '../../lib/oncallAnonService'

const MAX_SECONDS = 60

interface Props {
  supabase: SupabaseClient
  passcode: string
  passphrase: string
  callId: string
  /** Plaintext cluster greeting — auto-played once before recording, if set. */
  greeting: OncallGreetingWire | null
  onClose: () => void
}

type State = 'greeting' | 'idle' | 'recording' | 'sending' | 'done' | 'error'

/**
 * Outside-bundle voicemail composer. Records (≤60s), AES-GCM-encrypts the blob with a
 * random key, and hands the ciphertext + key to the oncall-resolve EDGE FN (which uploads
 * the blob to storage and authors the resolved card E2E). No seal-to-clinic-key, no
 * `src/lib/signal/*` import — just WebCrypto AES-GCM (aesGcm).
 */
export function OncallVoicemailRecorder({ supabase, passcode, passphrase, callId, greeting, onClose }: Props) {
  const [state, setState] = useState<State>(greeting ? 'greeting' : 'idle')
  const [seconds, setSeconds] = useState(0)
  const controllerRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const greetingAudioRef = useRef<HTMLAudioElement | null>(null)
  const greetingUrlRef = useRef<string | null>(null)

  const stopTicker = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }, [])

  // Auto-play the cluster greeting once, then fall through to the recorder. A
  // play failure (autoplay blocked, decode error) just advances to recording —
  // the greeting is a courtesy, never a gate.
  useEffect(() => {
    if (state !== 'greeting') return
    if (!greeting) { setState('idle'); return }
    let cancelled = false
    try {
      const blob = new Blob([base64ToBytes(greeting.audio) as BlobPart], { type: greeting.mime || 'audio/webm' })
      const url = URL.createObjectURL(blob)
      greetingUrlRef.current = url
      const audio = new Audio(url)
      greetingAudioRef.current = audio
      const advance = () => { if (!cancelled) setState('idle') }
      audio.onended = advance
      audio.onerror = advance
      audio.play().catch(advance)
    } catch {
      setState('idle')
    }
    return () => { cancelled = true }
  }, [state, greeting])

  const skipGreeting = useCallback(() => {
    greetingAudioRef.current?.pause()
    setState('idle')
  }, [])

  const finish = useCallback(async () => {
    const controller = controllerRef.current
    controllerRef.current = null
    stopTicker()
    if (!controller) { setState('error'); return }
    setState('sending')
    try {
      const rec = await controller.stop()
      // Random AES-256-GCM key; encrypt the blob (aesGcmEncrypt prepends the 12-byte IV).
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      const plain = new Uint8Array(await rec.blob.arrayBuffer())
      const combined = await aesGcmEncrypt(key, plain)
      const rawKey = await crypto.subtle.exportKey('raw', key)
      const ok = await submitOncallVoicemail(supabase, {
        passcode, passphrase, callId,
        audio: bytesToBase64(combined),
        key: bytesToBase64(new Uint8Array(rawKey)),
        mime: rec.mime, duration: rec.duration, waveform: rec.waveform,
      })
      setState(ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }, [stopTicker, supabase, passcode, passphrase, callId])

  const begin = useCallback(async () => {
    try {
      controllerRef.current = await startRecording()
      setSeconds(0)
      setState('recording')
      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1
          if (next >= MAX_SECONDS) { void finish() }
          return next
        })
      }, 1000)
    } catch {
      setState('error')
    }
  }, [finish])

  useEffect(() => () => {
    stopTicker()
    controllerRef.current?.cancel()
    greetingAudioRef.current?.pause()
    if (greetingUrlRef.current) URL.revokeObjectURL(greetingUrlRef.current)
  }, [stopTicker])

  return (
    <>
      <div className="pb-2">
        <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Voicemail</p>
      </div>
      <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-5">
        {state === 'greeting' && (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-themeblue3 animate-pulse" />
              <span className="text-sm font-medium text-primary">Playing greeting…</span>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={skipGreeting}
                className="h-9 px-4 rounded-full flex items-center justify-center bg-themewhite text-secondary text-[10pt] font-medium active:scale-95 transition-all"
              >
                Skip
              </button>
            </div>
          </>
        )}

        {state === 'idle' && (
          <>
            <p className="text-sm font-medium text-primary mb-1">No one answered</p>
            <p className="text-[10pt] text-secondary leading-relaxed mb-4">Leave a voice message (up to 60 seconds).</p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={begin}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                aria-label="Record voicemail"
              >
                <Mic size={22} />
              </button>
            </div>
          </>
        )}

        {state === 'recording' && (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-themeredred animate-pulse" />
              <span className="font-mono text-lg text-primary">
                {String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')}
              </span>
              <span className="text-[10pt] text-tertiary">/ 1:00</span>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void finish()}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all"
                aria-label="Stop and send"
              >
                <Square size={20} />
              </button>
            </div>
          </>
        )}

        {state === 'sending' && (
          <div className="flex items-center justify-center gap-2 py-2 text-secondary">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-[10pt]">Delivering…</span>
          </div>
        )}

        {state === 'done' && (
          <div className="flex items-center gap-2 text-themegreen">
            <Check size={18} />
            <span className="text-sm font-medium">Voicemail delivered.</span>
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-center gap-2 text-themeredred">
            <X size={18} />
            <span className="text-sm font-medium">Couldn’t deliver the voicemail.</span>
          </div>
        )}
      </div>

      {(state === 'done' || state === 'error') && (
        <div className="flex items-center justify-end gap-2 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
            aria-label="Done"
          >
            <Check size={16} />
          </button>
        </div>
      )}
    </>
  )
}
