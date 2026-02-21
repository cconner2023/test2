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
