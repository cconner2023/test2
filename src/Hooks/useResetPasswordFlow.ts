import { useCallback, useState } from 'react'
import { resetUserPassword } from '../lib/adminService'
import type { ServiceResult } from '../lib/result'

/**
 * Shared state + RPC handling for the inline admin reset-password flow.
 * Two-step submit: caller invokes `requestConfirm(userId)` from the form's
 * submit button, which moves the flow into a "pending confirm" state. The
 * caller renders a ConfirmDialog bound to `confirmingUserId` and calls
 * `submit()` on confirm. This guarantees both call sites share the same
 * destructive-action gate.
 */
export function useResetPasswordFlow() {
  const [value, setValue] = useState('')
  const [processing, setProcessing] = useState(false)
  const [confirmingUserId, setConfirmingUserId] = useState<string | null>(null)

  const requestConfirm = useCallback((userId: string): boolean => {
    if (value.length < 12) return false
    setConfirmingUserId(userId)
    return true
  }, [value])

  const cancelConfirm = useCallback(() => setConfirmingUserId(null), [])

  const submit = useCallback(async (): Promise<ServiceResult> => {
    if (!confirmingUserId) return { success: false, error: 'No pending reset request.' }
    setProcessing(true)
    const result = await resetUserPassword(confirmingUserId, value)
    setProcessing(false)
    setConfirmingUserId(null)
    if (result.success) setValue('')
    return result
  }, [confirmingUserId, value])

  const reset = useCallback(() => setValue(''), [])

  return {
    value,
    setValue,
    processing,
    confirmingUserId,
    requestConfirm,
    cancelConfirm,
    submit,
    reset,
  }
}
