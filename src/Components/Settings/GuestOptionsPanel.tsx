import { LogIn, UserPlus } from 'lucide-react'

interface GuestOptionsPanelProps {
  onSignIn: () => void
  onRequestAccount: () => void
}

export const GuestOptionsPanel = ({
  onSignIn,
  onRequestAccount
}: GuestOptionsPanelProps) => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <p className="text-[10pt] font-normal text-tertiary mb-5 items-center">
          You're currently using the app as a guest. Your preferences and training completion are saved locally to this device
        </p>

        <div className="flex w-full gap-2 justify-between">
          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                     bg-themeblue3 text-white font-medium hover:bg-themeblue2/90
                     transition-colors"
          >
            <LogIn size={18} />
            Sign In
          </button>

          <button
            onClick={onRequestAccount}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                     bg-themewhite2 text-primary font-medium border border-tertiary/20
                     hover:bg-tertiary/10 transition-colors text-sm"
          >
            <UserPlus size={18} />
            Request Account
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-tertiary/10">
          <h3 className="text-sm font-semibold text-primary mb-2">Guest Mode</h3>
          <ul className="text-xs text-tertiary space-y-1">
            <li>✓ full access to knowledge base</li>
            <li>✗ No messaging</li>
            <li>✗ No property management</li>
            <li>✗ No user ID or transfer between devices</li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-tertiary/10">
          <h3 className="text-sm font-semibold text-primary mb-2">With an Account</h3>
          <ul className="text-xs text-tertiary space-y-1">
            <li>✓ Store preferences across devices</li>
            <li>✓ Log and track training completion</li>
            <li>✓ Validate training with a supervisor</li>
            <li>✓ Encrypted messaging and calls between your clinic members </li>
            <li>✓ Property Management with chain of custody and DA 2062 creation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
