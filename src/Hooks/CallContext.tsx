/**
 * CallContext — Keeps call orchestration alive at the app level.
 *
 * Mirrors the MessagesContext pattern: mounts the useCall() hook once
 * so the incoming-call listener and call state persist across
 * Settings drawer open/close.
 */

import { createContext, useContext } from 'react'
import { useCall, type CallActions } from './useCall'
import { useAuth } from './useAuth'

const CallContext = createContext<CallActions | null>(null)

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()

  // Only mount useCall when authenticated
  const actions = useCall()

  return (
    <CallContext.Provider value={isAuthenticated ? actions : null}>
      {children}
    </CallContext.Provider>
  )
}

/** Consume the app-level call actions. Returns null if not authenticated. */
export function useCallActions(): CallActions | null {
  return useContext(CallContext)
}
