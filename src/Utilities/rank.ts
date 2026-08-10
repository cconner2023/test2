/**
 * Rank ↔ component rule, kept table-agnostic on purpose.
 *
 * Rank options depend on the component (Active/Guard/Reserve/…), so changing
 * the component can strand a rank the new one doesn't offer. Four surfaces edit
 * this pair — the admin user detail, the account-request approval form, and the
 * supervisor's member-edit and add-member popovers — and each had its own copy
 * of the invalidation check.
 *
 * The rank TABLE is not imported here: the two supervisor popovers lazy-load
 * `Data/User` to keep those tables out of their bundle, so a helper that reached
 * for the table itself could not be shared with them. Callers pass whichever
 * rank list they already hold.
 */

/** The rank to keep after a component change: the current one if the new
 *  component offers it, otherwise cleared. */
export function rankForComponent(ranks: readonly string[] | undefined, currentRank: string): string {
  if (!currentRank) return ''
  return ranks?.includes(currentRank) ? currentRank : ''
}
