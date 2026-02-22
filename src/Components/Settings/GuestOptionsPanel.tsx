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
          You're currently using the app as a guest. Your notes are saved locally to this device
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
                     bg-yellow-50 text-yellow-700 font-normal border border-yellow-200
                     transition-colors text-sm"
          >
            <UserPlus size={18} />
            Account creation disabled for beta
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-tertiary/10">
          <h3 className="text-sm font-semibold text-primary mb-2">Guest Mode</h3>
          <ul className="text-xs text-tertiary space-y-1">
            <li>✓ Full app functionality</li>
            <li>✓ Notes saved locally</li>
            <li>✗ No sync across devices</li>
            <li>✗ Notes may be lost if you clear browser data</li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-tertiary/10">
          <h3 className="text-sm font-semibold text-primary mb-2">With an Account</h3>
          <ul className="text-xs text-tertiary space-y-1">
            <li>✓ Sync notes across all devices</li>
            <li>✓ Secure cloud backup</li>
            <li>✓ Access from anywhere</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
