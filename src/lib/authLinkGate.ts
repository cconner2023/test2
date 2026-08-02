import { useSyncExternalStore } from 'react'

/**
 * Boot-time gate for auth-email links (`?token_hash=...&type=...`).
 *
 * send-auth-email mints our own branded link rather than the supabase.co verify
 * URL, so `detectSessionInUrl` never consumes it and the exchange is ours to make
 * (App.tsx). That ownership is what makes gating possible at all: the token can be
 * exchanged, the resulting identity inspected, and the session withheld from the
 * store — no swap has to be un-done.
 *
 * Only the FOREIGN case is held here. A link for the account this browser already
 * holds is that account's own session and is safe to accept; it is kept out of the
 * app by leaving the lock overlays up, not by gating the store.
 */

export type LinkKind = 'recovery' | 'magiclink'

export interface LinkIdentity {
  userId: string
  email: string
  kind: LinkKind
}

export interface SessionTokens {
  access_token: string
  refresh_token: string
}

export interface GateState {
  /** True from the moment a foreign link is detected until the user resolves it. */
  holding: boolean
  /** Account the link belongs to. Null until verifyOtp returns. */
  incoming: LinkIdentity | null
  /** Account this browser already held when the link arrived. */
  incumbent: { userId: string; email: string } | null
  /**
   * The incumbent's live session as it stood BEFORE the token was spent, so
   * declining the switch can put it back. verifyOtp replaces the client session
   * unconditionally, so without this the incumbent is forced to re-authenticate
   * just because someone opened the wrong link here. Memory only — never
   * persisted, and dropped when the gate releases.
   */
  incumbentSession: SessionTokens | null
}

const IDLE: GateState = { holding: false, incoming: null, incumbent: null, incumbentSession: null }

let _state: GateState = IDLE
let _deferred: (() => void) | null = null
const _listeners = new Set<() => void>()

function emit(): void {
  for (const listener of _listeners) listener()
}

export function getLinkGate(): GateState {
  return _state
}

export function isLinkGateHolding(): boolean {
  return _state.holding
}

/**
 * Raise the gate before spending the token. It has to go up first: the identity
 * is unknowable until verifyOtp returns, and the auth event fires DURING that
 * await, so a gate raised afterwards would already have missed the swap.
 */
export function holdLinkExchange(
  incumbent: { userId: string; email: string },
  incumbentSession: SessionTokens | null,
): void {
  _state = { holding: true, incoming: null, incumbent, incumbentSession }
  emit()
}

/** The exchange named an account other than the incumbent. Keep holding. */
export function resolveForeignLink(incoming: LinkIdentity): void {
  _state = { ..._state, holding: true, incoming }
  emit()
}

/**
 * Park an auth event the store must not act on yet. Returns false when the gate
 * is down, in which case the caller applies it directly.
 *
 * Only the most recent event is kept: auth state is a current-value signal, not a
 * log, so replaying a superseded session would move the store backwards.
 */
export function deferWhileHolding(apply: () => void): boolean {
  if (!_state.holding) return false
  _deferred = apply
  return true
}

/**
 * Drop the gate. `replay` runs the parked event, which is right when the incumbent
 * is being kept and the session that fired it is still the live one. The switch
 * path passes false — it discards local identity and re-establishes the session
 * itself, so replaying a stale event would fight it.
 */
export function releaseLinkGate(replay = true): void {
  const parked = _deferred
  _deferred = null
  _state = IDLE
  emit()
  if (replay) parked?.()
}

function subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => { _listeners.delete(listener) }
}

export function useLinkGate(): GateState {
  return useSyncExternalStore(subscribe, getLinkGate, getLinkGate)
}
