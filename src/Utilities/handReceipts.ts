import type { CustodyLedgerEntry, HandReceipt, HolderInfo, TurnInDoc } from '../Types/PropertyTypes'

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

export interface TurnInFold {
  /** Staged turn_in rows still pending the depot run (item NOT yet turned_in_at). */
  pending: CustodyLedgerEntry[]
  /** Completed turn-in documents (have ≥1 verified item), newest first. */
  history: TurnInDoc[]
}

/**
 * Fold the custody ledger's `turn_in` rows (DA 3161 turn-in) into pending vs completed.
 * A row is PENDING while its item is still on the books (id absent from
 * `turnedInItemIds`); once verified (turned_in_at set → id present) the row belongs to a
 * COMPLETED doc. Rows whose item left the IDB projection entirely (`liveItemIds`) are
 * dropped. Mirrors groupHandReceipts; the 2062 fold ignores these rows (action !=
 * sign_down) so the two surfaces never mix on the shared doc-id column.
 */
export function groupTurnIns(
  entries: CustodyLedgerEntry[],
  turnedInItemIds: Set<string>,
  liveItemIds: Set<string>,
): TurnInFold {
  const pending: CustodyLedgerEntry[] = []
  const byDoc = new Map<string, CustodyLedgerEntry[]>()
  for (const e of entries) {
    if (e.action !== 'turn_in' || !e.hand_receipt_id) continue
    if (!liveItemIds.has(e.item_id)) continue
    if (turnedInItemIds.has(e.item_id)) {
      const arr = byDoc.get(e.hand_receipt_id) ?? []
      arr.push(e)
      byDoc.set(e.hand_receipt_id, arr)
    } else {
      pending.push(e)
    }
  }
  pending.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))

  const history: TurnInDoc[] = []
  for (const [turnInDocId, rows] of byDoc) {
    rows.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    const head = rows[0]
    history.push({ turnInDocId, recordedAt: head.recorded_at, recordedBy: head.recorded_by, notes: head.notes, entries: rows })
  }
  history.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  return { pending, history }
}
