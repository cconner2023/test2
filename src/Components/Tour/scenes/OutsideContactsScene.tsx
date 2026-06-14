import { useState, useEffect } from 'react';
import { ShieldAlert, Link2, UserCheck, Users } from 'lucide-react';

interface OutsideContactsSceneProps {
  currentStep: number;
  isMobile: boolean;
}

// Mock roster — operational only, no PHI. Two on-shift, one off.
const ROSTER = [
  { name: 'SSG Rivera', role: 'On-call lead', onShift: true },
  { name: 'SPC Okafor', role: '68W · Medic', onShift: true },
  { name: 'PFC Lang', role: '68W · Medic', onShift: false },
];

/**
 * Release-only scene for the "Outside contacts" feature. Renders self-contained
 * MOCK replicas of the on-call roster + the inbound outside-message and
 * event-intake cards — it never mounts the live IntakeRequestCard /
 * OutsideMessageCard (which import signal/* and wire calendar/messaging hooks)
 * and never touches the messaging pipeline. Purely visual: when the tour ends
 * the scene unmounts and reveals the Release Notes panel underneath.
 */
export default function OutsideContactsScene({ isMobile }: OutsideContactsSceneProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-tour-scene
      className="fixed inset-0 z-[9996] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className={`h-full w-full flex items-center justify-center ${isMobile ? '' : 'bg-themewhite2'}`}>
        <div
          className={`flex flex-col relative overflow-hidden bg-themewhite ${
            isMobile
              ? 'w-full h-full'
              : 'max-w-md w-full m-5 h-[85%] rounded-md border border-[rgba(0,0,0,0.03)] shadow-[0px_2px_4px] shadow-[rgba(0,0,0,0.1)]'
          }`}
        >
          {/* Header chrome — reads like the messages on-call group */}
          <div
            className="h-14 shrink-0 bg-themewhite flex items-center gap-2.5 px-4 border-b border-tertiary/10"
            style={{ paddingTop: isMobile ? 'var(--sat)' : undefined }}
          >
            <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
              <Users size={18} className="text-themeblue2" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-primary truncate">On-call · Cluster group</span>
              <span className="text-[9pt] text-tertiary">Outside contacts route here</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-4 py-4 space-y-4">
            {/* ── On-call roster ─────────────────────────────────── */}
            <section data-tour="oc-roster" className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
              <div className="px-4 pt-3 pb-1.5">
                <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">On-call roster</p>
              </div>
              {ROSTER.map((m) => (
                <div key={m.name} className="flex items-center gap-3 px-4 py-2.5 border-t border-themeblue3/10">
                  <div className="w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
                    <UserCheck size={15} className="text-themeblue2/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{m.name}</p>
                    <p className="text-[9pt] text-tertiary">{m.role}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[9pt] font-semibold ${m.onShift ? 'text-themegreen' : 'text-tertiary'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.onShift ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
                    {m.onShift ? 'On shift' : 'Off'}
                  </span>
                </div>
              ))}
            </section>

            {/* ── Published outside link ─────────────────────────── */}
            <section data-tour="oc-publish" className="rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-themegreen/15 flex items-center justify-center shrink-0">
                <Link2 size={16} className="text-themegreen" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">Outside link active</p>
                <p className="text-[9pt] text-tertiary">Secure link + passphrase · no account needed</p>
              </div>
            </section>

            {/* ── Inbound outside message (replica of OutsideMessageCard) ── */}
            <div data-tour="oc-outside-message" className="flex justify-start items-center">
              <div className="max-w-[75%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-themewhite2 text-primary">
                <div className="pb-1.5 mb-1.5 border-b border-current/10">
                  <span className="text-[9pt] font-semibold text-themeblue2">CW2 Daniels (Range Control)</span>
                </div>
                <p className="text-sm">Need a medic for the 0600 live-fire iteration tomorrow — can your cluster cover?</p>
              </div>
            </div>

            {/* ── Inbound event-intake request (replica of IntakeRequestCard) ── */}
            <div data-tour="oc-intake-request" className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-themewhite2 text-primary px-3.5 py-2">
                <div className="inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-md text-[8pt] font-semibold tracking-wide uppercase text-themeyellow bg-themeyellow/10">
                  <ShieldAlert size={10} />
                  External · Unverified
                </div>
                <div className="space-y-1 text-[10pt]">
                  <div><span className="text-primary/50">From:</span> CW2 Daniels — Range Control</div>
                  <div><span className="text-primary/50">Email:</span> <span className="underline text-primary">daniels@range.mil</span></div>
                  <div><span className="text-primary/50">Window:</span> Wed, 0600–1200</div>
                  <div><span className="text-primary/50">Title:</span> Live-fire range coverage</div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  <span className="px-2.5 py-1 rounded-lg text-[9pt] font-semibold text-white bg-themeblue3">Approve</span>
                  <span className="px-2.5 py-1 rounded-lg text-[9pt] font-semibold text-themeredred bg-themeredred/10">Decline</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
