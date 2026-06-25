import { useCallback, useState } from 'react'
import { useDA2062Export } from './useDA2062Export'
import { useAuthStore } from '../stores/useAuthStore'
import {
  signInReceipt,
  removeReceiptItem,
  addReceiptItems,
  deleteHandReceipt,
} from '../lib/propertyService'
import { invalidate } from '../stores/useInvalidationStore'
import type { HandReceipt, HolderInfo } from '../Types/PropertyTypes'
import type { DA2062Params } from '../Utilities/DA2062Export'
import type { ReceiptItem } from './useHandReceipts'

/** Short, human date for the reprinted 2062's header. */
function formatReceiptDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Assemble the DA 2062 params to REPRINT an existing hand receipt — items resolved
 * from itemsById, the "from" holder from membersById, the "to" holder from the
 * receipt's recipient label. Exported so a surface can reprint into its OWN object-
 * view surface (e.g. PropertyPanel's right pane / detail sheet) without pulling in
 * the full mutate-actions hook.
 */
export function buildReprint2062Params(
  r: HandReceipt,
  itemsById: Map<string, ReceiptItem>,
  membersById: Map<string, HolderInfo>,
): DA2062Params {
  // Carry each row's signed-out count (quantity_delta) into the reprinted QTY
  // column so a reprint matches the original 2062. Absent → 1.
  const items = r.entries
    .map((e) => {
      const it = itemsById.get(e.item_id)
      return it ? { ...it, quantity: e.quantity_delta ?? 1 } : null
    })
    .filter((i): i is ReceiptItem & { quantity: number } => !!i)
  const fromHolder: HolderInfo = membersById.get(r.recordedBy) ?? {
    id: r.recordedBy,
    rank: null,
    firstName: null,
    lastName: null,
    displayName: 'Hand Receipt Holder',
  }
  const toHolder: HolderInfo = {
    id: r.toHolderId ?? 'external',
    rank: null,
    firstName: null,
    lastName: null,
    displayName: r.recipientLabel,
  }
  return {
    items,
    fromHolder,
    toHolder,
    handReceiptNumber: `HR-${r.handReceiptId.slice(0, 8).toUpperCase()}`,
    date: formatReceiptDate(r.recordedAt),
  }
}

interface HandReceiptActionsOpts {
  clinicId?: string | null
  /** id → lean item row (for assembling the reprinted 2062). */
  itemsById: Map<string, ReceiptItem>
  /** id → member info (the "from" holder on a reprint). */
  membersById: Map<string, HolderInfo>
  /** Re-pull the receipt list after a successful sign-in. */
  refetch: () => void
}

/**
 * Shared DA 2062 hand-receipt mutate actions — reprint, sign-in, add/remove item,
 * delete — used by the property Custody surface (CustodyPanel) so the lifecycle
 * logic lives in one place. Sign-in goes through the propertyService
 * directly (not the store) so it works from surfaces that may open without the
 * property store initialised. Confirm the sign-in via a ConfirmDialog wired to
 * `pendingSignIn` / `confirmSignIn`.
 */
export function useHandReceiptActions({ clinicId, itemsById, membersById, refetch }: HandReceiptActionsOpts) {
  const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview } = useDA2062Export()
  const [pendingSignIn, setPendingSignIn] = useState<HandReceipt | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reprint = useCallback(
    async (r: HandReceipt) => {
      await exportDA2062(buildReprint2062Params(r, itemsById, membersById))
    },
    [itemsById, membersById, exportDA2062],
  )

  // ── Edit / delete the 2062 (USR: "consider it an edited signal message") ──
  // All go through the propertyService directly (like sign-in) + invalidate +
  // refetch, so they work from a surface opened without the property store.
  const [pendingDelete, setPendingDelete] = useState<HandReceipt | null>(null)

  const afterMutate = useCallback(() => {
    invalidate('properties')
    refetch()
  }, [refetch])

  /** Remove one item from a receipt (and sign it back in). */
  const removeItem = useCallback(
    async (handReceiptId: string, itemId: string) => {
      const userId = useAuthStore.getState().user?.id
      if (!userId || !clinicId) return
      setBusyId(handReceiptId)
      const result = await removeReceiptItem(handReceiptId, itemId, clinicId, userId)
      setBusyId(null)
      if (result.success) afterMutate()
    },
    [clinicId, afterMutate],
  )

  /** Add items to an existing receipt. */
  const addItems = useCallback(
    async (handReceiptId: string, itemIds: string[]) => {
      const userId = useAuthStore.getState().user?.id
      if (!userId || !clinicId || itemIds.length === 0) return
      setBusyId(handReceiptId)
      const result = await addReceiptItems(handReceiptId, itemIds, clinicId, userId)
      setBusyId(null)
      if (result.success) afterMutate()
    },
    [clinicId, afterMutate],
  )

  /** Delete the whole receipt (confirm via `pendingDelete` / `confirmDelete`). */
  const confirmDelete = useCallback(async () => {
    const r = pendingDelete
    setPendingDelete(null)
    if (!r || !clinicId) return
    const userId = useAuthStore.getState().user?.id
    if (!userId) return
    setBusyId(r.handReceiptId)
    const result = await deleteHandReceipt(r.handReceiptId, clinicId, userId)
    setBusyId(null)
    if (result.success) afterMutate()
  }, [pendingDelete, clinicId, afterMutate])

  const confirmSignIn = useCallback(async () => {
    const r = pendingSignIn
    if (!r || !clinicId) {
      setPendingSignIn(null)
      return
    }
    const userId = useAuthStore.getState().user?.id
    if (!userId) {
      setPendingSignIn(null)
      return
    }
    setBusyId(r.handReceiptId)
    setPendingSignIn(null)
    const result = await signInReceipt(
      r.handReceiptId,
      clinicId,
      r.toHolderId,
      r.entries.map((e) => e.item_id),
      userId,
    )
    setBusyId(null)
    if (result.success) {
      invalidate('properties')
      refetch()
    }
  }, [pendingSignIn, clinicId, refetch])

  return {
    reprint,
    pendingSignIn,
    setPendingSignIn,
    confirmSignIn,
    // edit / delete
    removeItem,
    addItems,
    pendingDelete,
    setPendingDelete,
    confirmDelete,
    busyId,
    da2062Preview,
    downloadDA2062,
    clearDA2062Preview,
  }
}
