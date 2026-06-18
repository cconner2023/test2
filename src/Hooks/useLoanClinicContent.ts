/**
 * Fetches note content (text templates / order sets / plan tags) for a set of
 * clinics the user is loaned into, so it can be merged into note-writing. RLS
 * permits these reads because the user is in auth_clinic_ids() for each loan.
 *
 * Used only for SUBSCRIBED loan clinics (see useTemplateSubscription) — home
 * content already lives in useAuthStore, so it isn't refetched here. Results are
 * cached per clinic id; the id set rarely changes (only on loan add/remove or a
 * subscription toggle).
 */

import { useEffect, useRef, useState } from 'react'
import { getClinicNoteContent, type ClinicNoteContent } from '../lib/supervisorService'

const cache = new Map<string, ClinicNoteContent>()

export function useLoanClinicContent(clinicIds: string[]): ClinicNoteContent[] {
  const key = [...clinicIds].sort().join(',')
  const [contents, setContents] = useState<ClinicNoteContent[]>(
    () => clinicIds.map(id => cache.get(id)).filter((c): c is ClinicNoteContent => !!c),
  )
  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    if (clinicIds.length === 0) {
      setContents([])
      return
    }
    let cancelled = false
    Promise.all(
      clinicIds.map(async id => {
        const hit = cache.get(id)
        if (hit) return hit
        const res = await getClinicNoteContent(id)
        if (res.ok) {
          cache.set(id, res.data)
          return res.data
        }
        return null
      }),
    ).then(results => {
      // Ignore a resolution from a stale id set (loans/subscription changed mid-flight).
      if (cancelled || keyRef.current !== key) return
      setContents(results.filter((c): c is ClinicNoteContent => !!c))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return contents
}
