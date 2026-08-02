import { useIsMobile } from '../../Hooks/useIsMobile'

/**
 * The two row densities every card row in the app is drawn at, in one place.
 *
 * WHY THIS EXISTS: the densities were introduced inside SettingsRow (2026-07-30)
 * because phone-authored rows read as "cartoony" once Settings gained a desktop
 * three-pane layout. Every card row that was NOT a SettingsRow — readiness bars,
 * competency categories, timeline events, certifications — kept its phone padding
 * and phone type size, so a single scroll column now mixed a tightened row group
 * with a loose one. Reading the density off a shared hook is what keeps the two
 * groups from drifting again.
 *
 * Mobile is the surface these were drawn for and is unchanged. Desktop drops the
 * ornament that only reads as a touch affordance and takes the 10pt floor.
 */
export interface RowDensity {
    isMobile: boolean
    /** The one primary string in a row. Pair with `font-medium`. */
    label: string
    /** Standard row padding. */
    pad: string
    /** One level of nesting under the row above. */
    indentPad: string
    /** Press feedback — a finger gets one, a cursor does not. */
    press: string
    /** Leading glyph. */
    iconSize: number
}

const MOBILE: RowDensity = {
    isMobile: true,
    label: 'text-sm',
    pad: 'px-4 py-3.5',
    indentPad: 'pl-16 pr-4 py-3',
    press: 'active:scale-95',
    iconSize: 18,
}

const DESKTOP: RowDensity = {
    isMobile: false,
    label: 'text-[10pt]',
    pad: 'px-4 py-2.5',
    indentPad: 'pl-11 pr-4 py-2',
    press: '',
    iconSize: 16,
}

export function useRowDensity(): RowDensity {
    return useIsMobile() ? MOBILE : DESKTOP
}

/** Secondary line under a label, and trailing meta (date, count, status word).
 *  Fixed at the 9pt dense floor on both densities — already the smallest thing
 *  in the row, so there is nothing to tighten. */
export const ROW_META = 'text-[9pt] text-tertiary'

/** Detail rows revealed by expanding a row — content, not meta, so it holds the
 *  10pt floor and separates from its parent label by weight and colour. */
export const ROW_DETAIL = 'text-[10pt] text-secondary'

/** Status pill inside a row (GO / NO GO / Untested). Caller adds the tone. */
export const ROW_BADGE = 'px-2 py-0.5 rounded text-[9pt] font-semibold shrink-0'

/** Body copy in an otherwise empty card. */
export const CARD_EMPTY = 'text-[10pt] text-tertiary'
