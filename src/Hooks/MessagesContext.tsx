/**
 * MessagesContext — Keeps messaging state alive across Settings drawer open/close.
 *
 * The useMessages() hook lives here at the app level, so conversations,
 * unread counts, and the realtime subscription persist even when
 * MessagesPanel unmounts.
 */

import { createContext, useContext } from 'react'
import { useMessages, type UseMessagesReturn } from './useMessages'
import { useAuth } from './useAuth'

const MessagesContext = createContext<UseMessagesReturn | null>(null)

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()

  // Only mount useMessages when authenticated (it guards internally too,
  // but this avoids unnecessary IDB/realtime work for guests)
  const messages = useMessages()

  return (
    <MessagesContext.Provider value={isAuthenticated ? messages : null}>
      {children}
    </MessagesContext.Provider>
  )
}

/** Consume the app-level messaging state. Returns null if not authenticated. */
export function useMessagesContext(): UseMessagesReturn | null {
  return useContext(MessagesContext)
}
