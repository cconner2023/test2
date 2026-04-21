import { create } from 'zustand'
import type { MedevacRequest } from '../Types/MedevacTypes'
import { emptyMedevacRequest } from '../Types/MedevacTypes'
import { saveActiveDraft, loadActiveDraft, clearActiveDraft } from '../lib/medevacDb'

interface MedevacState {
  req: MedevacRequest
  hydrated: boolean
}

interface MedevacActions {
  setReq: (req: MedevacRequest) => void
  resetReq: () => void
  hydrateFromIdb: () => Promise<void>
}

export type MedevacStore = MedevacState & MedevacActions

export const useMedevacStore = create<MedevacStore>()((set) => ({
  req: emptyMedevacRequest(),
  hydrated: false,

  setReq: (req) => {
    set({ req })
    saveActiveDraft(req)
  },

  resetReq: () => {
    set({ req: emptyMedevacRequest() })
    clearActiveDraft()
  },

  hydrateFromIdb: async () => {
    const req = await loadActiveDraft()
    if (req) set({ req })
    set({ hydrated: true })
  },
}))

export function hydrateMedevacStore(): Promise<void> {
  return useMedevacStore.getState().hydrateFromIdb()
}
