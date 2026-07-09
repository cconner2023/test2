import { Clock, UserCheck, X, HelpCircle } from 'lucide-react'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'

export interface RequestCardProps {
  request: AccountRequest
  matchedClinic: AdminClinic | undefined
  onOpen: (request: AccountRequest) => void
}

/**
 * Request row — icon + up to three lines of text (name · credential/email ·
 * UIC/cluster). Tapping opens the full request detail in the drawer's detail
 * pane / Sheet (see RequestDetail); the row itself carries no actions.
 */
export function RequestCard({ request, matchedClinic, onOpen }: RequestCardProps) {
  const isSupport = request.request_type === 'support'

  const iconBg = isSupport
    ? 'bg-themeblue2/10'
    : request.status === 'pending'  ? 'bg-themeyellow/10'
    : request.status === 'approved' ? 'bg-themegreen/10'
    : request.status === 'rejected' ? 'bg-themeredred/10'
    : 'bg-tertiary/10'

  const IconComponent = isSupport
    ? HelpCircle
    : request.status === 'pending'  ? Clock
    : request.status === 'approved' ? UserCheck
    : X

  const iconColor = isSupport
    ? 'text-themeblue2'
    : request.status === 'pending'  ? 'text-themeyellow'
    : request.status === 'approved' ? 'text-themegreen'
    : 'text-themeredred'

  const name = isSupport
    ? `${request.first_name}${request.last_name ? ` ${request.last_name}` : ''}`
    : [request.rank, request.first_name, request.middle_initial, request.last_name].filter(Boolean).join(' ')

  const line2 = isSupport
    ? request.email
    : [request.credential, request.email].filter(Boolean).join(' · ')

  const line3 = isSupport
    ? request.notes || ''
    : request.uic
      ? `${request.uic} · ${matchedClinic ? matchedClinic.name : 'No cluster match'}`
      : request.notes || ''

  return (
    <button
      type="button"
      onClick={() => onOpen(request)}
      className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-themeblue2/5 active:scale-[0.99] transition-all select-none"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
        <IconComponent size={16} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{name}</p>
        {line2 && <p className="text-[9pt] text-tertiary mt-0.5 truncate">{line2}</p>}
        {line3 && <p className="text-[9pt] text-tertiary mt-0.5 truncate">{line3}</p>}
      </div>
    </button>
  )
}
