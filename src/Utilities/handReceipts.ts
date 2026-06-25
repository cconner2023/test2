import type { CustodyLedgerEntry, HandReceipt, HolderInfo } from '../Types/PropertyTypes'

/**
 * Fold clinic custody-ledger rows into DA 2062 hand receipts, grouped by
 * hand_receipt_id. Only rows that carry a hand_receipt_id participate (legacy
 * transfers and expend rows are ignored). A receipt's header comes from its
 * sign_down rows; matching sign_up rows flip it to 'returned'. Newest first.
 *
 * `liveItemIds`, when supplied, drops the row of any item deleted from
 * accountability (item tombstoned + gone from the IDB projection on every
 * device) — the same shape as editing the 2062 to remove that one item. A
 * receipt whose every item was deleted folds to nothing and is omitted. The
 * ledger spine itself is append-only/immutable — this is a view-time filter.
 */
export function groupHandReceipts(
  entries: CustodyLedgerEntry[],
  holders: Map<string, HolderInfo>,
  liveItemIds?: Set<string>,
): HandReceipt[] {
  const byReceipt = new Map<string, CustodyLedgerEntry[]>()
  for (const e of entries) {
    if (!e.hand_receipt_id) continue
    if (liveItemIds && !liveItemIds.has(e.item_id)) continue // item deleted from accountability
    const arr = byReceipt.get(e.hand_receipt_id) ?? []
    arr.push(e)
    byReceipt.set(e.hand_receipt_id, arr)
  }

  const receipts: HandReceipt[] = []
  for (const [handReceiptId, rows] of byReceipt) {
    const signOuts = rows.filter((r) => r.action === 'sign_down')
    if (signOuts.length === 0) continue // stray sign_up with no matching sign_out
    const signIns = rows.filter((r) => r.action === 'sign_up')

    signOuts.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    const head = signOuts[0]
    const toHolderId = head.to_holder_id
    const isExternal = !toHolderId
    // External recipient name is the first segment of the free-text row notes.
    const recipientLabel = isExternal
      ? head.notes?.split(' — ')[0]?.trim() || 'External recipient'
      : holders.get(toHolderId!)?.displayName || 'Unknown member'

    const returned = signIns.length >= signOuts.length
    const returnedAt = returned
      ? signIns.map((r) => r.recorded_at).sort().slice(-1)[0] ?? null
      : null

    receipts.push({
      handReceiptId,
      toHolderId,
      isExternal,
      recipientLabel,
      recordedAt: head.recorded_at,
      recordedBy: head.recorded_by,
      notes: head.notes,
      status: returned ? 'returned' : 'open',
      returnedAt,
      entries: signOuts,
    })
  }

  receipts.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  return receipts
}
