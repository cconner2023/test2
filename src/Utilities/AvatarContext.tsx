import { createContext, useContext } from 'react'
import type { useProfileAvatar } from '../Hooks/useProfileAvatar'

type AvatarState = ReturnType<typeof useProfileAvatar>

const AvatarContext = createContext<AvatarState | null>(null)

export const AvatarProvider = ({ children, value }: { children: React.ReactNode; value: AvatarState }) => (
    <AvatarContext.Provider value={value}>
        {children}
    </AvatarContext.Provider>
)

export function useAvatar() {
    const ctx = useContext(AvatarContext)
    if (!ctx) throw new Error('useAvatar must be used within an AvatarProvider')
    return ctx
}
