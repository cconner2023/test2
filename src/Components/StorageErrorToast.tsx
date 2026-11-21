import React, { useCallback, useEffect, useState } from 'react'
import { TopBanner } from './primitives/TopBanner'
import { onErrorToast, type ErrorToast } from '../lib/errorFeedback'

/** App-root host: shows whatever `emitErrorToast` sends. */
export const ErrorToastHost: React.FC = () => {
  const [toast, setToast] = useState<ErrorToast | null>(null)
  useEffect(() => onErrorToast(setToast), [])
  const dismiss = useCallback(() => setToast(null), [])
  return (
    <TopBanner
      item={toast}
      tone="error"
      zIndex={81}
      autoDismissMs={5000}
      onDismiss={dismiss}
      title={(t) => t.title}
      body={(t) => t.message}
    />
  )
}
