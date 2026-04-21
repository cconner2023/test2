import { createIdbSingleton } from './idbFactory'
import type { DBSchema } from 'idb'
import type { MedevacRequest } from '../Types/MedevacTypes'

interface MedevacDraft {
  id: string
  req: MedevacRequest
  updatedAt: string
}

interface MedevacDB extends DBSchema {
  activeDraft: {
    key: string
    value: MedevacDraft
  }
}

const { getDb } = createIdbSingleton<MedevacDB>('beacon-medevac', 1, {
  upgrade(db) {
    db.createObjectStore('activeDraft', { keyPath: 'id' })
  },
})

export async function saveActiveDraft(req: MedevacRequest): Promise<void> {
  const db = await getDb()
  await db.put('activeDraft', { id: 'active', req, updatedAt: new Date().toISOString() })
}

export async function loadActiveDraft(): Promise<MedevacRequest | null> {
  const db = await getDb()
  const record = await db.get('activeDraft', 'active')
  return record ? record.req : null
}

export async function clearActiveDraft(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('activeDraft', 'readwrite')
  await tx.objectStore('activeDraft').clear()
  await tx.done
}
