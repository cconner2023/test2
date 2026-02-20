import { Edit2 } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'

const DisplayField = ({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) => (
  <div className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
    <div className="mt-1 px-3 py-2.5 rounded-lg bg-themewhite2/50 text-primary text-base border border-tertiary/10">
      {value || <span className="text-tertiary/30 italic">Not set</span>}
    </div>
  </div>
)

interface UserProfileDisplayProps {
  onRequestChange: () => void
}

export const UserProfileDisplay = ({ onRequestChange }: UserProfileDisplayProps) => {
  const { profile } = useAuth()

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-primary">Your Profile</h2>
            <p className="text-sm text-tertiary/60 mt-1">
              Profile information is read-only. Request changes below.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <DisplayField label="First Name" value={profile.firstName} />
            <DisplayField label="Last Name" value={profile.lastName} />
          </div>

          <DisplayField label="Middle Initial" value={profile.middleInitial} />
          <DisplayField label="Credential" value={profile.credential} />
          <DisplayField label="Component" value={profile.component} />
          <DisplayField label="Rank" value={profile.rank} />
          <DisplayField label="UIC" value={profile.uic} />
        </div>

        {profile.lastName && profile.credential && (
          <div className="mt-6 pt-4 border-t border-tertiary/10">
            <p className="text-xs text-tertiary/60 uppercase tracking-wide mb-1">Signature Preview</p>
            <p className="text-sm text-primary font-medium">
              Signed: {profile.lastName} {profile.firstName} {profile.middleInitial}{' '}
              {profile.credential}
              {profile.rank ? `, ${profile.rank}` : ''}
              {profile.component ? `, ${profile.component}` : ''}
              {profile.uic ? ` | UIC: ${profile.uic}` : ''}
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-tertiary/10">
          <button
            onClick={onRequestChange}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                     bg-themeblue2 text-white font-medium hover:bg-themeblue2/90
                     transition-colors"
          >
            <Edit2 size={18} />
            Request Profile Changes
          </button>
          <p className="text-xs text-tertiary/60 text-center mt-2">
            All profile changes require administrator approval
          </p>
        </div>
      </div>
    </div>
  )
}
