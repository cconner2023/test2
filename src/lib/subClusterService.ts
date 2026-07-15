import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { ok, err, succeed, fail, type Result, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'

/**
 * Sub-cluster CRUD — intra-clinic render/grouping layer (ONE flat level).
 * Same clinicVault; render-only. Mutations go through SECURITY DEFINER RPCs
 * (supervisor/dev-gated, clinic-scoped); reads use the RLS-scoped select.
 * See v2/supervisor sub-cluster drawer.
 */

const logger = createLogger('SubClusterService')

export interface SubCluster {
  id: string
  clinic_id: string
  name: string
  created_at: string
}

/** Read the caller's clinic sub-cluster list, scoped to the passed clinic.
 *  The `sub_clusters_select` RLS policy grants dev a cross-clinic read
 *  carve-out, so an unfiltered select would leak EVERY clinic's sub-clusters
 *  into a dev's own-clinic view. Filter explicitly so this own-clinic hook only
 *  ever returns the caller's clinic — the dev carve-out is only for the admin
 *  cross-clinic reads (fetchAllSubClusters / fetchClinicSubClusters). */
export async function fetchSubClusters(clinicId: string): Promise<Result<SubCluster[]>> {
  const { data, error } = await supabase
    .from('sub_clusters')
    .select('id, clinic_id, name, created_at')
    .eq('clinic_id', clinicId)
    .order('name', { ascending: true })
  if (error) {
    logger.warn('fetchSubClusters failed:', error.message)
    return err(error.message)
  }
  return ok((data ?? []) as SubCluster[])
}

export async function createSubCluster(name: string): Promise<ServiceResult<{ subCluster: SubCluster }>> {
  const { data, error } = await supabase.rpc('create_sub_cluster', { p_name: name })
  if (error) {
    logger.error('createSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed({ subCluster: data as SubCluster })
}

export async function renameSubCluster(id: string, name: string): Promise<ServiceResult<{ subCluster: SubCluster }>> {
  const { data, error } = await supabase.rpc('rename_sub_cluster', { p_id: id, p_name: name })
  if (error) {
    logger.error('renameSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed({ subCluster: data as SubCluster })
}

export async function deleteSubCluster(id: string): Promise<ServiceResult> {
  const { error } = await supabase.rpc('delete_sub_cluster', { p_id: id })
  if (error) {
    logger.error('deleteSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed()
}

/** Assign a soldier to a sub-cluster, or null = HQ/unassigned bucket. */
export async function setMemberSubCluster(userId: string, subClusterId: string | null): Promise<ServiceResult> {
  const { error } = await supabase.rpc('supervisor_set_sub_cluster', {
    p_user_id: userId,
    p_sub_cluster_id: subClusterId,
  })
  if (error) {
    logger.error('setMemberSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed()
}

// ── Dev / admin console (global, cross-clinic) ───────────────────────────────

/** Dev-only: read EVERY clinic's sub-clusters in one shot (RLS grants dev
 *  cross-clinic read). Feeds the admin Directory tree, which nests each
 *  cluster's roster under its sub-units. Render-only grouping — see
 *  Utilities/subCluster.ts. */
export async function fetchAllSubClusters(): Promise<Result<SubCluster[]>> {
  const { data, error } = await supabase
    .from('sub_clusters')
    .select('id, clinic_id, name, created_at')
    .order('name', { ascending: true })
  if (error) {
    logger.warn('fetchAllSubClusters failed:', error.message)
    return err(error.message)
  }
  return ok((data ?? []) as SubCluster[])
}

/** Dev-only: read a SPECIFIC clinic's sub-clusters (RLS grants dev cross-clinic read). */
export async function fetchClinicSubClusters(clinicId: string): Promise<Result<SubCluster[]>> {
  const { data, error } = await supabase
    .from('sub_clusters')
    .select('id, clinic_id, name, created_at')
    .eq('clinic_id', clinicId)
    .order('name', { ascending: true })
  if (error) {
    logger.warn('fetchClinicSubClusters failed:', error.message)
    return err(error.message)
  }
  return ok((data ?? []) as SubCluster[])
}

/** Dev-only: assign any user to a sub-cluster of THAT user's clinic (or null = HQ). */
export async function adminSetMemberSubCluster(userId: string, subClusterId: string | null): Promise<ServiceResult> {
  const { error } = await supabase.rpc('admin_set_sub_cluster', {
    p_user_id: userId,
    p_sub_cluster_id: subClusterId,
  })
  if (error) {
    logger.error('adminSetMemberSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed()
}

/** Dev-only: create a sub-cluster in a SPECIFIC clinic (the clinic being managed). */
export async function adminCreateSubCluster(clinicId: string, name: string): Promise<ServiceResult<{ subCluster: SubCluster }>> {
  const { data, error } = await supabase.rpc('admin_create_sub_cluster', { p_clinic_id: clinicId, p_name: name })
  if (error) {
    logger.error('adminCreateSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed({ subCluster: data as SubCluster })
}

/** Dev-only: rename any sub-cluster by id. */
export async function adminRenameSubCluster(id: string, name: string): Promise<ServiceResult<{ subCluster: SubCluster }>> {
  const { data, error } = await supabase.rpc('admin_rename_sub_cluster', { p_id: id, p_name: name })
  if (error) {
    logger.error('adminRenameSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed({ subCluster: data as SubCluster })
}

/** Dev-only: delete any sub-cluster by id. Members fall back to HQ (FK SET NULL). */
export async function adminDeleteSubCluster(id: string): Promise<ServiceResult> {
  const { error } = await supabase.rpc('admin_delete_sub_cluster', { p_id: id })
  if (error) {
    logger.error('adminDeleteSubCluster failed:', error.message)
    return fail(getErrorMessage(error))
  }
  return succeed()
}
