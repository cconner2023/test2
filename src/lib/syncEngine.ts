import { isOnline } from './syncService'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('SyncEngine')

export interface SyncableConfig<T> {
  tableName: string
  upsertFn: (record: T) => Promise<void>
  updateSyncStatus: (id: string, status: string, error?: string) => Promise<void>
}

export async function immediateSync<T extends { id: string }>(
  record: T,
  config: SyncableConfig<T>,
  action: 'create' | 'update' | 'delete'
): Promise<boolean> {
  if (!isOnline()) {
    return false
  }

  try {
    await config.upsertFn(record)
    await config.updateSyncStatus(record.id, 'synced')
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`Immediate ${action} sync failed for ${config.tableName}/${record.id}, queued: ${msg}`)
    return false
  }
}
