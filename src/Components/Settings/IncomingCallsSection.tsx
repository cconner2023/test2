import { useState, useEffect } from 'react'
import { PhoneIncoming, PhoneOff, Radio } from 'lucide-react'
import { Section, SectionCard } from '@/Components/primitives/Section'
import { ToggleSwitch } from './ToggleSwitch'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useAuthStore } from '../../stores/useAuthStore'
import { fetchSelfOnCall } from '../../lib/oncallService'

/**
 * Per-user incoming-call switch. Off = silenced (soft block): incoming
 * medic↔medic calls are auto-declined on this device and the caller drops into
 * the voicemail path (greeting playback + leave-a-voice-note), handled by
 * useCall / CallOverlay. Persisted on profiles.allow_calls (synced like
 * `theme`/`swipeActions`).
 *
 * Clinic on-call presence (clinics.oncall) is a HARD override — while on-call you
 * always ring, so the toggle is replaced by a static on-call indicator (you can't
 * silence yourself while on duty).
 */
export function IncomingCallsSection() {
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const allow = profile?.allowCalls !== false // default true

  const userId = useAuthStore((s) => s.user?.id ?? null)
  const clinicId = useAuthStore((s) => s.clinicId)
  const surrogateClinicIds = useAuthStore((s) => s.surrogateClinicIds)

  const [onCall, setOnCall] = useState(false)
  useEffect(() => {
    if (!userId) { setOnCall(false); return }
    let cancelled = false
    const clinicIds = [clinicId, ...(surrogateClinicIds ?? [])].filter((x): x is string => !!x)
    fetchSelfOnCall(clinicIds, userId).then((v) => { if (!cancelled) setOnCall(v) })
    return () => { cancelled = true }
  }, [userId, clinicId, surrogateClinicIds])

  const toggle = () => {
    const next = !allow
    updateProfile({ allowCalls: next })       // instant local (memory + localStorage)
    syncProfileField({ allow_calls: next })    // cross-device push
  }

  return (
    <Section title="Calls" className="">
      <SectionCard>
        {onCall ? (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full bg-themegreen/15 flex items-center justify-center shrink-0">
              <Radio size={18} className="text-themegreen" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">On-call — calls always ring</p>
              <p className="text-[9pt] text-tertiary mt-0.5">Incoming calls can't be silenced while you're on-call.</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-primary/[0.03] transition-colors"
            aria-pressed={allow}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${allow ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
              {allow
                ? <PhoneIncoming size={18} className="text-themeblue2" />
                : <PhoneOff size={18} className="text-tertiary" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-primary">Allow incoming calls</p>
              <p className="text-[9pt] text-tertiary mt-0.5">
                {allow ? 'Teammates can call you directly.' : 'Callers are sent to your voicemail.'}
              </p>
            </div>
            <ToggleSwitch checked={allow} />
          </button>
        )}
      </SectionCard>
    </Section>
  )
}
