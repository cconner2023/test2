import { useState } from 'react'
import { ShieldCheck, Activity, EyeOff, FileText, Scale } from 'lucide-react'
import { SectionCard } from './Section'

/**
 * Bump this when the acknowledgment content changes materially.
 * Users who accepted a previous version will be prompted again.
 */
export const ACK_VERSION = 1
const ACK_STORAGE_KEY = `adtmc_user_ack_v${ACK_VERSION}`

/**
 * Check whether the user has already accepted this version of the acknowledgment.
 * @param checkPersistent  When true, also checks localStorage (for authenticated
 *                         users whose acceptance persists across sessions).
 */
export function hasAcceptedAcknowledgment(checkPersistent = false): boolean {
  try {
    if (checkPersistent && localStorage.getItem(ACK_STORAGE_KEY) === 'true') return true
    return sessionStorage.getItem(ACK_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Record that the user accepted the acknowledgment.
 * Always writes to sessionStorage. When `persistent` is true (authenticated users),
 * also writes to localStorage so it survives across sessions.
 */
export function recordAcknowledgment(persistent = false): void {
  try {
    sessionStorage.setItem(ACK_STORAGE_KEY, 'true')
    if (persistent) localStorage.setItem(ACK_STORAGE_KEY, 'true')
  } catch { /* ignore */ }
}

interface UserAcknowledgmentProps {
  onAccept: () => void
  /** When true, acceptance is persisted to localStorage (for authenticated users). */
  persistent?: boolean
}

const AckRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex gap-3 px-4 py-3.5">
    <div className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0 text-sm text-tertiary leading-relaxed">{children}</div>
  </div>
)

export const UserAcknowledgment = ({ onAccept, persistent }: UserAcknowledgmentProps) => {
  const [checked, setChecked] = useState(false)

  const handleAccept = () => {
    if (!checked) return
    recordAcknowledgment(persistent)
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
                Clinical notes are generated and stored on-device only. No PHI or PII is transmitted to or retained on any external server. Do not enter patient names, SSNs, DoD IDs, dates of birth, or other HIPAA Safe Harbor identifiers.
              </p>
            </AckRow>

            <AckRow icon={<FileText size={16} className="text-tertiary" />}>
              <p>
                <strong className="text-primary font-medium">You are responsible for shared content.</strong>{' '}
                When you export or copy a clinical note — barcode, DD Form 689, or plain text — you assume responsibility for handling that information in accordance with HIPAA, DoD 6025.18-R, and your organization's privacy policies.
              </p>
            </AckRow>

            <AckRow icon={<Scale size={16} className="text-tertiary" />}>
              <p>
                <strong className="text-primary font-medium">Provided as-is.</strong>{' '}
                This software is provided without warranty. Clinical content is for reference only and may not reflect the most current guidelines. Always verify critical information through authoritative sources.
              </p>
            </AckRow>
          </SectionCard>
        {/* Acceptance checkbox */}
        <label className="flex items-start gap-3 mb-5 cursor-pointer px-1 w-full">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-themeblue3/10 text-themeblue2 focus:ring-themeblue2 shrink-0 cursor-pointer accent-themeblue2"
          />
            <span className="text-sm text-primary leading-relaxed">
            I understand no patient data is stored externally. I accept responsibility for any unauthorized PHI/PII release resulting from my use of this application.
          </span>
        </label>

        {/* Accept button */}
        <button
          onClick={handleAccept}
          disabled={!checked}
            className="w-full py-2.5 px-4 rounded-full bg-themeblue3 text-white text-sm font-medium active:scale-95 transition-all disabled:opacity-30"
        >
          Continue
        </button>
      </div>
      </div>
    </div>
  )
}
