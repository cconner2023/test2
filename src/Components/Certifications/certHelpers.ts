/**
 * Canonical cert helpers shared by Settings (self) and Admin (other users).
 * Previously duplicated in adminUtils.tsx and Supervisor/supervisorHelpers.ts.
 */

export type ExpirationStatus = 'valid' | 'expiring' | 'expired' | 'none'

export function getExpirationStatus(expDate: string | null): ExpirationStatus {
  if (!expDate) return 'none'
  const now = new Date()
  const exp = new Date(expDate)
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'expired'
  if (diffDays <= 90) return 'expiring'
  return 'valid'
}

export const certBadgeColors: Record<ExpirationStatus, string> = {
  valid:    'bg-themegreen/10 text-themegreen border-themegreen/30',
  expiring: 'bg-themeyellow/10 text-themeyellow border-themeyellow/30',
  expired:  'bg-themeredred/10 text-themeredred border-themeredred/30',
  none:     'bg-tertiary/5 text-tertiary border-tertiary/20',
}

export function statusLabel(s: ExpirationStatus): { text: string; cls: string } {
  switch (s) {
    case 'valid':    return { text: 'Valid',    cls: 'text-themegreen bg-themegreen/10' }
    case 'expiring': return { text: 'Expiring', cls: 'text-themeyellow bg-themeyellow/10' }
    case 'expired':  return { text: 'Expired',  cls: 'text-themeredred bg-themeredred/10' }
    default:         return { text: 'No Date',  cls: 'text-tertiary bg-tertiary/5' }
  }
}

export function formatCertDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export type CertFormData = {
  title: string
  cert_number: string
  issue_date: string
  exp_date: string
  is_primary: boolean
}

export const emptyCertForm: CertFormData = {
  title: '',
  cert_number: '',
  issue_date: '',
  exp_date: '',
  is_primary: false,
}
