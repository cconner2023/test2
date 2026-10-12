import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { ok, err, succeed, fail, type Result, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'

/**
 * Cluster directory — the clusters the caller "knows" (own, loans, parent,
 * children, associated peers, supervisor scope) with their nicknames.
 * Nickname display is gated on membership in this set; every other cluster
 * renders its unit name (clinics.name). See Utilities/clusterLabel.ts.
 */

const logger = createLogger('ClusterDirectoryService')

export type ClusterRelation = 'own' | 'scope' | 'parent' | 'child' | 'peer'

export interface ClusterDirectoryEntry {
  id: string
  name: string
  nickname: string | null
  relation: ClusterRelation
}

export async function fetchClusterDirectory(): Promise<Result<ClusterDirectoryEntry[]>> {
  const { data, error } = await supabase.rpc('get_cluster_directory')
  if (error) {
    logger.error('fetchClusterDirectory failed:', error.message)
    return err(error.message)
  }
  return ok((data ?? []) as ClusterDirectoryEntry[])
}

/** Supervisor (own scope) or dev. Empty/whitespace clears the nickname. */
export async function setClusterNickname(
  clinicId: string,
  nickname: string,
): Promise<ServiceResult<{ id: string; name: string; nickname: string | null }>> {
  try {
    const { data, error } = await supabase.rpc('set_clinic_nickname', { p_clinic_id: clinicId, p_nickname: nickname })
    if (error) {
      logger.error('setClusterNickname failed:', error.message)
      return fail(error.message)
    }
    return succeed(data as unknown as { id: string; name: string; nickname: string | null })
  } catch (e) {
    return fail(getErrorMessage(e))
  }
}
