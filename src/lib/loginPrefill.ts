/**
 * Smart defaults for the unauthenticated login surface — the one place that
 * decides what a blank form can fill in on the user's behalf.
 *
 * Two sources feed it: what this device already knows (last signed-in address,
 * an unfinished account request) and what the typed email implies (DoD local
 * parts encode a name, DoD domains encode a service component). Every derived
 * value is written into a visible, editable field and announced, never applied
 * silently — a wrong guess must be as easy to see as it is to fix.
 */

const LAST_EMAIL_KEY = 'adtmc_last_signin_email'
const REQUEST_DRAFT_KEY = 'adtmc_account_request_draft'

/** Drafts go stale faster than they stay useful; an approval cycle is days, not weeks. */
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private-mode / quota — prefill is an enhancement, never a hard dependency.
  }
}

function drop(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // As above.
  }
}

/* ── Remembered sign-in address ── */

/** Called on every successful sign-in so the next visit starts half-filled. */
export function rememberSignInEmail(email: string) {
  const trimmed = email.trim()
  if (trimmed) write(LAST_EMAIL_KEY, trimmed)
}

export function getRememberedEmail(): string {
  return read(LAST_EMAIL_KEY)?.trim() ?? ''
}

/** Backs the "Not you?" escape hatch — devices get handed between medics. */
export function forgetRememberedEmail() {
  drop(LAST_EMAIL_KEY)
}

/* ── Derivation from the email address ── */

export interface DerivedName {
  firstName: string
  lastName: string
  middleInitial: string
}

/** Affiliation suffixes DoD appends to the local part; they are not name parts. */
const AFFILIATION_SUFFIXES = new Set(['mil', 'civ', 'ctr'])

/** Title-case a single name token, preserving internal hyphens and apostrophes. */
function titleCase(token: string): string {
  return token.replace(/[a-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
}

/**
 * Pull a name out of a DoD-style address (`first.m.last.mil@army.mil`, also
 * plain `first.last@`). Anything that can't be read with confidence comes back
 * empty rather than guessed — a single-letter token is an initial, not a first
 * name, and a local part with no separator carries no recoverable structure.
 */
export function parseNameFromEmail(email: string): DerivedName {
  const blank: DerivedName = { firstName: '', lastName: '', middleInitial: '' }

  const local = email.trim().toLowerCase().split('@')[0]
  if (!local) return blank

  const parts = local
    .split('.')
    .map((p) => p.replace(/\d+$/, '').trim())
    .filter(Boolean)

  while (parts.length > 2 && AFFILIATION_SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop()
  }
  if (parts.length < 2) return blank

  const first = parts[0]
  const last = parts[parts.length - 1]
  const middle = parts.length > 2 ? parts[1] : ''

  return {
    firstName: first.length > 1 ? titleCase(first) : '',
    lastName: last.length > 1 ? titleCase(last) : '',
    middleInitial: middle ? middle.charAt(0).toUpperCase() : '',
  }
}

/**
 * Service component implied by the email domain. Joint domains (`mail.mil`,
 * `health.mil`) resolve to nothing on purpose — they span all four services, so
 * a guess there would be wrong as often as right.
 */
export function componentFromEmail(email: string): string {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain) return ''
  if (/(^|\.)army\.mil$/.test(domain)) return 'USA'
  if (/(^|\.)navy\.mil$/.test(domain)) return 'USN'
  if (/(^|\.)(usmc|marines)\.mil$/.test(domain)) return 'USMC'
  if (/(^|\.)af\.mil$/.test(domain)) return 'USAF'
  return ''
}

/* ── Account-request draft ── */

/**
 * The request form is the longest form a user ever meets, and they meet it
 * before they have any reason to trust it. Losing it to a backgrounded tab is
 * the cheapest possible way to lose the user, so the non-secret fields persist.
 * Passwords and the contact consent are deliberately excluded: one must not be
 * at rest in localStorage, the other must be an affirmative act every time.
 */
export interface AccountRequestDraft {
  email: string
  firstName: string
  lastName: string
  middleInitial: string
  credential: string
  component: string
  rank: string
  uic: string
  notes: string
  savedAt: number
}

export type AccountRequestDraftFields = Omit<AccountRequestDraft, 'savedAt'>

export function saveRequestDraft(fields: AccountRequestDraftFields) {
  const hasContent = Object.values(fields).some((v) => v.trim())
  if (!hasContent) {
    clearRequestDraft()
    return
  }
  write(REQUEST_DRAFT_KEY, JSON.stringify({ ...fields, savedAt: Date.now() }))
}

export function readRequestDraft(): AccountRequestDraftFields | null {
  const raw = read(REQUEST_DRAFT_KEY)
  if (!raw) return null
  try {
    const { savedAt, ...fields } = JSON.parse(raw) as AccountRequestDraft
    if (!savedAt || Date.now() - savedAt > DRAFT_TTL_MS) {
      clearRequestDraft()
      return null
    }
    return {
      email: fields.email ?? '',
      firstName: fields.firstName ?? '',
      lastName: fields.lastName ?? '',
      middleInitial: fields.middleInitial ?? '',
      credential: fields.credential ?? '',
      component: fields.component ?? '',
      rank: fields.rank ?? '',
      uic: fields.uic ?? '',
      notes: fields.notes ?? '',
    }
  } catch {
    clearRequestDraft()
    return null
  }
}

export function clearRequestDraft() {
  drop(REQUEST_DRAFT_KEY)
}
