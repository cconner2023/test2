/**
 * soundService — Synthesized audio feedback for messaging.
 *
 * Uses Web Audio API OscillatorNode to generate short tones.
 * No MP3 files needed — everything is synthesized on the fly.
 *
 * AudioContext is lazy-created on first playSendSound() call,
 * which is user-initiated (button tap) and unlocks the context
 * for subsequent playReceiveSound() calls.
 */

const SOUNDS_KEY = 'messageSoundsEnabled'

/** Check if message sounds are enabled (default: true). */
export function isMessageSoundsEnabled(): boolean {
  try { return localStorage.getItem(SOUNDS_KEY) !== 'false' } catch { return true }
}

/** Set the message sounds preference. */
export function setMessageSoundsEnabled(enabled: boolean): void {
  try { localStorage.setItem(SOUNDS_KEY, String(enabled)) } catch { /* noop */ }
}

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Short rising tone (~150ms) — subtle send confirmation. */
export function playSendSound(): void {
  try {
    if (!isMessageSoundsEnabled()) return
    const ac = getContext()
    if (!ac) return

    const osc = ac.createOscillator()
    const gain = ac.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ac.currentTime)
    osc.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.12)

    gain.gain.setValueAtTime(0.08, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(ac.destination)

    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + 0.15)
  } catch {
    // Audio failure never blocks messaging
  }
}

/** Gentle two-note chime (~300ms) — incoming message notification. */
export function playReceiveSound(): void {
  try {
    if (!isMessageSoundsEnabled()) return
    const ac = getContext()
    if (!ac) return

    // Note 1: soft ping
    const osc1 = ac.createOscillator()
    const gain1 = ac.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, ac.currentTime)
    gain1.gain.setValueAtTime(0.06, ac.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15)
    osc1.connect(gain1)
    gain1.connect(ac.destination)
    osc1.start(ac.currentTime)
    osc1.stop(ac.currentTime + 0.15)

    // Note 2: higher follow-up (delayed 120ms)
    const osc2 = ac.createOscillator()
    const gain2 = ac.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1100, ac.currentTime + 0.12)
    gain2.gain.setValueAtTime(0.0001, ac.currentTime)
    gain2.gain.setValueAtTime(0.06, ac.currentTime + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
    osc2.connect(gain2)
    gain2.connect(ac.destination)
    osc2.start(ac.currentTime + 0.12)
    osc2.stop(ac.currentTime + 0.3)
  } catch {
    // Audio failure never blocks messaging
  }
}
