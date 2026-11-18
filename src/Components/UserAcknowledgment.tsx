import { useState } from 'react'
import { ShieldCheck, Activity, EyeOff, FileText, Scale, Lock, ChevronDown } from 'lucide-react'
import { SectionCard } from '@/Components/primitives/Section'
import { PrivacyPolicyContent } from '@/Components/Settings/PrivacyPolicyPanel'

/**
 * Bump this when the acknowledgment or the privacy policy changes materially.
 * Authenticated users who accepted a previous version will be re-prompted once
 * (their profiles.ack_version_accepted is below this number). See LockGate for
 * the gate; each acceptance is also logged to policy_acceptances.
 * v2: privacy policy acceptance and 18+ attestation added.
 */
export const ACK_VERSION = 2

interface UserAcknowledgmentProps {
  onAccept: () => void
}

const AckRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex gap-3 px-4 py-3.5">
    <div className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0 text-sm text-tertiary leading-relaxed">{children}</div>
  </div>
)

export const UserAcknowledgment = ({ onAccept }: UserAcknowledgmentProps) => {
  const [checked, setChecked] = useState(false)
  const [ageChecked, setAgeChecked] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)
  const canAccept = checked && ageChecked

  const handleAccept = () => {
    if (!canAccept) return
    onAccept()
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-themewhite overflow-y-auto select-none"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-6">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
            <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center mb-3">
              <ShieldCheck size={20} className="text-tertiary" />
          </div>
            <h1 className="text-[13pt] font-semibold text-primary">User Acknowledgment</h1>
        </div>

        {/* Content */}
          <SectionCard className="w-full divide-y divide-tertiary/10 mb-6">
            <AckRow icon={<Activity size={16} className="text-tertiary" />}>
              <p>
                <strong className="text-primary font-medium">Clinical decision-support tool.</strong>{' '}
                This application is a reference aid — not an electronic health record. It does not replace clinical judgment, established protocols, or supervising provider guidance, and does not establish a provider-patient relationship. Use within your scope of practice and credentials.
              </p>
            </AckRow>

            <AckRow icon={<EyeOff size={16} className="text-tertiary" />}>
              <p>
                <strong className="text-primary font-medium">No patient data stored on servers.</strong>{' '}
                Clinical notes are generated on-device only. PHI or PII is not transmitted to or retained on any external server.
              </p>
            </AckRow>

            <AckRow icon={<FileText size={16} className="text-tertiary" />}>
              <p>
                <strong className="text-primary font-medium">You are responsible for shared content.</strong>{' '}
                When you export or copy a note — barcode, DD Form 689, or plain text — you assume responsibility for handling that information in accordance with HIPAA, DoD 6025.18-R, and your organization's privacy policies.
              </p>
            </AckRow>

            <AckRow icon={<Scale size={16} className="text-tertiary" />}>
              <p>
                <strong className="text-primary font-medium">Provided as-is.</strong>{' '}
                This software is provided without warranty. Clinical content is for reference only. Always verify critical information through authoritative sources.
              </p>
            </AckRow>
            <AckRow icon={<Lock size={16} className="text-tertiary" />}>
              <p>
                <strong className="text-primary font-medium">Privacy Policy.</strong>{' '}
                Explains what account data is collected, the services the app connects to, browser storage use, and your rights.
              </p>
              <button
                type="button"
                onClick={() => setPolicyOpen(o => !o)}
                aria-expanded={policyOpen}
                className="mt-1.5 inline-flex items-center gap-1 text-themeblue2 font-medium"
              >
                {policyOpen ? 'Hide Privacy Policy' : 'Read Privacy Policy'}
                <ChevronDown size={14} className={`transition-transform ${policyOpen ? 'rotate-180' : ''}`} />
              </button>
            </AckRow>
          </SectionCard>

        {policyOpen && (
          <div className="w-full space-y-4 mb-6 select-text">
            <PrivacyPolicyContent />
          </div>
        )}

        {/* Age attestation. The app cannot verify age, so it asks; the policy
            commits to deleting accounts found to belong to minors. */}
        <label className="flex items-start gap-3 mb-3 cursor-pointer px-1 w-full">
          <input
            type="checkbox"
            checked={ageChecked}
            onChange={(e) => setAgeChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-themeblue3/10 text-themeblue2 focus:ring-themeblue2 shrink-0 cursor-pointer accent-themeblue2"
          />
            <span className="text-sm text-primary leading-relaxed">
            I am 18 years of age or older.
          </span>
        </label>

        {/* Acceptance checkbox */}
        <label className="flex items-start gap-3 mb-5 cursor-pointer px-1 w-full">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-themeblue3/10 text-themeblue2 focus:ring-themeblue2 shrink-0 cursor-pointer accent-themeblue2"
          />
            <span className="text-sm text-primary leading-relaxed">
            I have read and agree to the Privacy Policy. I understand no patient data is stored externally. I accept responsibility for any unauthorized PHI/PII release resulting from my use of this application.
          </span>
        </label>

        {/* Accept button */}
        <button
          onClick={handleAccept}
          disabled={!canAccept}
            className="w-full py-2.5 px-4 rounded-full bg-themeblue3 text-white text-sm font-medium active:scale-95 transition-all disabled:opacity-30"
        >
          Continue
        </button>
      </div>
      </div>
    </div>
  )
}
