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
        <p className="text-sm text-tertiary/60 mb-5">
          You're currently using the app as a guest. Your notes are saved locally on this device.
        </p>

        <div className="space-y-3">
          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                     bg-themeblue2 text-white font-medium hover:bg-themeblue2/90
                     transition-colors"
          >
            <LogIn size={18} />
            Sign In
          </button>

          <button
            onClick={onRequestAccount}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                     bg-green-600 text-white font-medium hover:bg-green-700
                     transition-colors"
          >
            <UserPlus size={18} />
            Request an Account
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-tertiary/10">
          <h3 className="text-sm font-semibold text-primary mb-2">Guest Mode</h3>
          <ul className="text-xs text-tertiary/70 space-y-1">
            <li>✓ Full app functionality</li>
            <li>✓ Notes saved locally</li>
            <li>✗ No sync across devices</li>
            <li>✗ Notes may be lost if you clear browser data</li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-tertiary/10">
          <h3 className="text-sm font-semibold text-primary mb-2">With an Account</h3>
          <ul className="text-xs text-tertiary/70 space-y-1">
            <li>✓ Sync notes across all devices</li>
            <li>✓ Secure cloud backup</li>
            <li>✓ Access from anywhere</li>
            <li>✓ Never lose your data</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
