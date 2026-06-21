import { useCallback, useState } from 'react'
import { useDA2062Export } from './useDA2062Export'
import { useAuthStore } from '../stores/useAuthStore'
import { signInReceipt } from '../lib/propertyService'
import { invalidate } from '../stores/useInvalidationStore'
import type { HandReceipt, HolderInfo } from '../Types/PropertyTypes'
import type { ReceiptItem } from './useHandReceipts'

/** Short, human date for the reprinted 2062's header. */
function formatReceiptDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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
 * Shared DA 2062 hand-receipt mutate actions — reprint and sign-in — used by both
 * the Settings AccountabilityPanel and the property-tree Hand Receipts section so
 * the lifecycle logic lives in one place. Sign-in goes through the propertyService
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
      const items = r.entries
        .map((e) => itemsById.get(e.item_id))
        .filter((i): i is ReceiptItem => !!i)
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
      await exportDA2062({
        items,
        fromHolder,
        toHolder,
        handReceiptNumber: `HR-${r.handReceiptId.slice(0, 8).toUpperCase()}`,
        date: formatReceiptDate(r.recordedAt),
      })
    },
    [itemsById, membersById, exportDA2062],
  )

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
    busyId,
    da2062Preview,
    downloadDA2062,
    clearDA2062Preview,
  }
}
