import { useEffect, useState } from 'react'
import type { AvatarBlob } from '../Types/SupervisorTestTypes'
import { decryptAvatarToUrl, getCachedAvatarUrl } from '../lib/avatarBlobService'

/**
 * Resolves a custom avatar to a renderable data URL.
 *
 * Returns null unless avatarId === 'custom' (callers fall back to preset SVG /
 * initials). When custom, prefers the synchronous cache, then decrypts the
 * provided blob, then — for the signed-in user, who has no blob threaded but
 * whose plaintext was seeded under `user:<id>` — the user-keyed cache.
 */
export function useResolvedAvatar(
  avatarId: string | null | undefined,
  avatarBlob?: AvatarBlob | null,
  userId?: string | null,
): string | null {
  const isCustom = avatarId === 'custom'
  const enc = isCustom ? (avatarBlob?.enc ?? null) : null
  const userKey = isCustom && userId ? `user:${userId}` : null

  const [url, setUrl] = useState<string | null>(() => {
    if (!isCustom) return null
    return (enc && getCachedAvatarUrl(enc)) || (userKey && getCachedAvatarUrl(userKey)) || null
  })

  useEffect(() => {
    if (!isCustom) { setUrl(null); return }

    const cached = (enc && getCachedAvatarUrl(enc)) || (userKey && getCachedAvatarUrl(userKey))
    if (cached) { setUrl(cached); return }

    if (avatarBlob) {
      let cancelled = false
      decryptAvatarToUrl(avatarBlob).then(u => { if (!cancelled) setUrl(u) })
      return () => { cancelled = true }
    }

    setUrl(null)
  }, [isCustom, enc, userKey, avatarBlob])

  return url
}
