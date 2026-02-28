export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; code?: string }

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data }
}

export function err<E = string>(error: E, code?: string): Result<never, E> {
  return code ? { ok: false, error, code } : { ok: false, error }
}

export function fromSupabase<T>(response: {
  data: T | null
  error: { message: string; code?: string } | null
}): Result<T> {
  if (response.error) {
    return err(response.error.message, response.error.code)
  }
  if (response.data === null) {
    return err('No data returned')
  }
  return ok(response.data)
}

// ─── Service-layer result helpers ────────────────────────────

/** Standardised result type for service mutation operations. */
export type ServiceResult<T extends Record<string, unknown> = Record<string, never>> =
  | ({ success: true } & T)
  | { success: false; error: string }

export function succeed(): { success: true }
export function succeed<T extends Record<string, unknown>>(extra: T): { success: true } & T
export function succeed(extra?: Record<string, unknown>) {
  return extra ? { success: true, ...extra } : { success: true }
}

export function fail(error: string): { success: false; error: string } {
  return { success: false, error }
}
