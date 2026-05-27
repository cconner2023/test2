import { useCallback, useEffect, useState } from 'react'
import { Radio, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/useAuthStore'
import { toggleOncallPresence } from '../../lib/oncallService'

/**
 * GATE-3 on-call presence. Any cluster member puts themselves on-call so the
 * outside-caller ring reaches their device. Self-service, sticky until toggled
 * off (no auto-expiry — the supervisor's GATE-1/GATE-2 stack is the real
 * off-switch). The "you are ON-CALL" banner is the sole visibility mechanism.
 *
 * Reads clinics.oncall directly (clinics SELECT policy is public); writes via the
 * SECURITY DEFINER toggle_oncall_presence RPC. Operates on the active cluster
 * (supervisingClinicId ?? home clinicId).
 */
export function OncallPresenceSection() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const clinicId = useAuthStore((s) => s.supervisingClinicId ?? s.clinicId)
  const [oncall, setOncall] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!clinicId) { setOncall([]); return }
    const { data } = await supabase.from('clinics').select('oncall').eq('id', clinicId).maybeSingle()
    setOncall(((data as { oncall?: string[] } | null)?.oncall) ?? [])
  }, [clinicId])

  useEffect(() => { void load() }, [load])

  const isOn = !!(userId && oncall?.includes(userId))
  const count = oncall?.length ?? 0

  const toggle = useCallback(async () => {
    if (!userId || !clinicId || busy) return
    setBusy(true)
    const res = await toggleOncallPresence(clinicId, userId, !isOn)
    if (res.ok) await load()
    setBusy(false)
  }, [userId, clinicId, busy, isOn, load])

  if (!clinicId) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">On-call</p>
      </div>

      {isOn && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-themegreen/10 border border-themegreen/20">
          <span className="w-2 h-2 rounded-full bg-themegreen animate-pulse shrink-0" />
          <p className="text-[10pt] font-medium text-themegreen">You are ON-CALL for outside callers.</p>
        </div>
      )}

      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isOn ? 'bg-themegreen/15' : 'bg-tertiary/10'}`}>
            <Radio size={18} className={isOn ? 'text-themegreen' : 'text-tertiary'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">{isOn ? 'On-call' : 'Off-call'}</p>
            <p className="text-[9pt] text-tertiary mt-0.5">
              {count} member{count === 1 ? '' : 's'} on-call in this cluster
            </p>
          </div>
          <button
            onClick={() => void toggle()}
            disabled={busy}
            className={`shrink-0 h-9 px-4 rounded-full flex items-center gap-1.5 text-[10pt] font-medium active:scale-95 transition-all ${isOn ? 'bg-tertiary/10 text-tertiary' : 'bg-themeblue3 text-white'}`}
          >
            {busy ? <RefreshCw size={14} className="animate-spin" /> : isOn ? 'Go off' : 'Go on-call'}
          </button>
        </div>
      </div>
    </div>
  )
}
