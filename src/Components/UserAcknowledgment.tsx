import { useState } from 'react'
import { ShieldCheck, EyeOff, FileText, UserCheck } from 'lucide-react'

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

const Section = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="w-7 h-7 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0 text-xs text-tertiary/80 leading-relaxed">{children}</div>
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
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-6">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-3">
            <ShieldCheck size={26} className="text-themeblue2" />
          </div>
          <h1 className="text-lg font-bold text-primary">User Acknowledgment</h1>
          <p className="text-xs text-tertiary/60 mt-1">Please review before continuing</p>
        </div>

        {/* Content */}
        <div className="w-full space-y-4 mb-6 px-1">
          <Section icon={<EyeOff size={14} className="text-themeblue2" />}>
            <p>
              <strong className="text-primary">No patient data is stored on our servers.</strong>{' '}
              Clinical notes, including HPI and physical exam documentation, are generated entirely on your device for your education. No Protected Health Information (PHI) or
              Personally Identifiable Information (PII) is transmitted to or stored on any server.
            </p>
          </Section>

          <Section icon={<FileText size={14} className="text-themeblue2" />}>
            <p>
              <strong className="text-primary">Notes are your responsibility.</strong>{' '}
              When you share or copy a clinical note — whether as a barcode,
              DD Form 689, or plain text — you assume responsibility for the handling
              of that information in accordance with HIPAA, DoD 6025.18-R, and your
              organization's privacy policies.
            </p>
          </Section>

          <Section icon={<UserCheck size={14} className="text-themeblue2" />}>
            <p>
              <strong className="text-primary">Do not enter patient-identifying information.</strong>{' '}
              This application is a clinical decision-support tool, not an electronic health record.
              Do not include patient names, Social Security Numbers, DoD ID numbers, dates of birth,
              or any other identifiers defined by the HIPAA Safe Harbor standard in your notes.
              The app will warn you if potential identifiers are detected, but you are ultimately
              responsible for ensuring compliance.
            </p>
          </Section>

          <div className="px-3 py-2.5 rounded-lg border border-tertiary/10 bg-themewhite2">
            <p className="text-[11px] text-tertiary/50 leading-relaxed">
              This application is provided as a clinical reference tool. It does not replace
              clinical judgment, established protocols, or the guidance of a supervising
              provider. Use of this tool does not establish a provider-patient relationship.
            </p>
          </div>
        </div>

        {/* Acceptance checkbox */}
        <label className="flex items-start gap-3 mb-5 cursor-pointer px-1 w-full">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-themegray1/40 text-themeblue2 focus:ring-themeblue2 shrink-0 cursor-pointer accent-themeblue2"
          />
          <span className="text-xs text-primary leading-relaxed">
            I understand that no patient data is stored on external servers, and I accept
            responsibility for any unauthorized release of PHI/PII that occurs due to my own actions using this application.
          </span>
        </label>

        {/* Accept button */}
        <button
          onClick={handleAccept}
          disabled={!checked}
          className="w-full py-3 rounded-lg bg-themeblue3 text-white text-sm font-medium disabled:opacity-30 transition-opacity"
        >
          Continue
        </button>
      </div>
      </div>
    </div>
  )
}
