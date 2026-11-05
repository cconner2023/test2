/**
 * fetch wrapper handed to createClient (global.fetch). Two auth-hardening jobs:
 *
 * 1. Clock-skew immunity. GoTrue returns `expires_at` stamped in SERVER time;
 *    auth-js compares it to the DEVICE clock to decide when to refresh. A device
 *    clock that is behind (seen on networks that block NTP) never refreshes in
 *    time and every request 401s. Stripping `expires_at` from token responses
 *    makes auth-js derive it from `expires_in` against the local clock, so the
 *    refresh schedule is relative and skew-free.
 *
 * 2. No false revocation. auth-js deletes the stored session on any non-5xx
 *    refresh failure, including a captive-portal / content-filter page that
 *    isn't GoTrue at all. A refresh failure without a GoTrue error body is
 *    re-thrown as a network error, which auth-js treats as retryable and keeps
 *    the refresh token. Genuine GoTrue rejections (error_code present) pass through.
 *
 * Plus a self-heal: a data request that 401s with an expired JWT (stale session
 * from before the fix, or skew in the other direction) forces one refresh and
 * replays the request with the new token.
 */

const AUTH_PATH = '/auth/v1/'
const EXPIRED_JWT = /jwt expired|PGRST303|token is expired/i

let refresher: (() => Promise<string | null>) | null = null
let refreshInFlight: Promise<string | null> | null = null

/** Registered by supabase.ts once the client exists (avoids a circular import). */
export function setAuthRefresher(fn: () => Promise<string | null>): void {
  refresher = fn
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

async function rebaseTokenExpiry(res: Response): Promise<Response> {
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return res
  let data: unknown
  try { data = await res.clone().json() } catch { return res }
  if (!data || typeof data !== 'object') return res
  const body = data as Record<string, unknown>
  if (!('access_token' in body) || typeof body.expires_in !== 'number' || !('expires_at' in body)) return res
  delete body.expires_at
  return new Response(JSON.stringify(body), { status: res.status, statusText: res.statusText, headers: res.headers })
}

async function isGenuineAuthError(res: Response): Promise<boolean> {
  try {
    const data = await res.clone().json()
    return !!data && typeof data === 'object' &&
      (typeof data.error_code === 'string' ||
        (typeof data.error === 'string' && typeof data.error_description === 'string'))
  } catch {
    return false
  }
}

function canReplay(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (input instanceof Request) return false
  const body = init?.body
  return !(typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
}

function refreshOnce(): Promise<string | null> {
  if (!refresher) return Promise.resolve(null)
  if (!refreshInFlight) {
    refreshInFlight = refresher().catch(() => null).finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export const authFetch: typeof fetch = async (input, init) => {
  const url = urlOf(input)

  if (url.includes(AUTH_PATH)) {
    const res = await fetch(input, init)
    if (url.includes('grant_type=refresh_token') && !res.ok && res.status < 500 && !(await isGenuineAuthError(res))) {
      throw new TypeError(`Refresh intercepted by network (HTTP ${res.status})`)
    }
    return rebaseTokenExpiry(res)
  }

  const res = await fetch(input, init)
  if (res.status !== 401 || !canReplay(input, init)) return res

  let text = ''
  try { text = await res.clone().text() } catch { return res }
  if (!EXPIRED_JWT.test(text)) return res

  const token = await refreshOnce()
  if (!token) return res
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
