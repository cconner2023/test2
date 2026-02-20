import { X } from 'lucide-react'
import { LoginPanel } from './Settings/LoginPanel'

interface LoginModalProps {
  isVisible: boolean
  onClose: () => void
  onContinueAsGuest: () => void
  onRequestAccount?: () => void
}

export const LoginModal = ({
  isVisible,
  onClose,
  onContinueAsGuest,
  onRequestAccount,
}: LoginModalProps) => {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-themewhite rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-tertiary/10">
          <h2 className="text-xl font-semibold text-primary">Sign In</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-themewhite2 transition-colors"
          >
            <X size={20} className="text-tertiary/60" />
          </button>
        </div>
        <LoginPanel
          variant="modal"
          onSuccess={onClose}
          onRequestAccount={() => {
            onClose()
            onRequestAccount?.()
          }}
          onContinueAsGuest={onContinueAsGuest}
        />
      </div>
    </div>
  )
}
