import { Sheet } from '../Sheet'
import { SignOutForm } from './SignOutForm'

interface SignOutSheetProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * New DA 2062, as a standalone bottom sheet. Used by the Settings
 * AccountabilityPanel. Inside the Property drawer the same SignOutForm is hosted
 * by PropertyPanel's detail surface (right pane / detail sheet) instead.
 */
export function SignOutSheet({ isOpen, onClose }: SignOutSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="New DA 2062" maxHeight={90}>
      <SignOutForm onClose={onClose} />
    </Sheet>
  )
}
