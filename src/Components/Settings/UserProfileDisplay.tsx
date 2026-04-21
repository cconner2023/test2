import { ChevronRight, Pencil } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'

interface UserProfileDisplayProps {
  onRequestChange: () => void
}

export const UserProfileDisplay = ({ onRequestChange }: UserProfileDisplayProps) => {
  const { profile } = useAuth()

  const fullName = [profile.firstName, profile.middleInitial, profile.lastName]
    .filter(Boolean)
    .join(' ')

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: 'Name', value: fullName || null },
    { label: 'Credential', value: profile.credential },
    { label: 'Component', value: profile.component },
    { label: 'Rank', value: profile.rank },
    { label: 'UIC', value: profile.uic },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-5">
        <p className="text-xs text-tertiary leading-relaxed">
          Profile information is read-only. Request changes below.
        </p>

        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {fields.map(({ label, value }) => (
            <div key={label} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-tertiary">{label}</span>
                <span className="text-sm font-medium text-primary">
                  {value || <span className="text-tertiary italic">Not set</span>}
                </span>
              </div>
            </div>
          ))}
        </div>

        {profile.lastName && profile.credential && (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-tertiary">Signature Preview</span>
                <span className="text-sm font-medium text-primary">
                  {profile.lastName} {profile.firstName} {profile.middleInitial}{' '}
                  {profile.credential}
                  {profile.rank ? `, ${profile.rank}` : ''}
                  {profile.component ? `, ${profile.component}` : ''}
                  {profile.uic ? ` | UIC: ${profile.uic}` : ''}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          <button
            onClick={onRequestChange}
            className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
              <Pencil size={18} className="text-tertiary" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-primary">Request Profile Changes</span>
              <p className="text-[9pt] text-tertiary mt-0.5">Requires administrator approval</p>
            </div>
            <ChevronRight size={16} className="text-tertiary shrink-0" />
          </button>
        </div>
      </div>
    </div>
  )
}
