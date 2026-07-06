import { createContext, type ReactNode } from 'react'

/**
 * stackNav — the shared contract between OverlayStack and any leaf that wants to
 * DRILL DOWN inside it instead of stacking its own overlay (the "pop-up" feel).
 *
 * This is a deliberately dependency-free leaf module: OverlayStack imports the
 * types + context from here, and so do leaves like the FormInputs pickers. Keeping
 * it standalone avoids the cycle FormInputs → OverlayStack → PreviewOverlay →
 * FormInputs (PreviewOverlay's inline-add row already imports FormInputs).
 */

export interface StackNav {
  /** Push a deeper screen declared in the OverlayStack `screens` map. */
  push: (key: string, params?: unknown) => void
  /** Swap the top screen in place (back skips it — e.g. camera → crop). */
  replace: (key: string, params?: unknown) => void
  /**
   * Push an AD-HOC screen the host never declared — the screen object travels with
   * the frame. This is what lets a leaf (a picker inside a field) morph the current
   * card instead of opening a nested overlay. The screen is frozen at push time, so
   * a screen that must stay live across re-renders should own its own local state.
   */
  pushScreen: (screen: StackScreen, params?: unknown) => void
  /** Pop one level. No-op at the root. */
  pop: () => void
  /** Pop all the way back to the root screen. */
  reset: () => void
  /** Current depth (1 = root). */
  depth: number
}

export interface StackScreen {
  /** Header title — a string or a fn of this screen's params. */
  title?: string | ((params: any) => string)
  /** When set, the underlying PreviewOverlay pins its search box above the body
   *  and the screen's `render` receives the live filter string (3rd arg). Screens
   *  without it render into the plain (non-searchable) body and get filter ''. */
  searchPlaceholder?: string
  /** The body content. Receives the search filter (3rd arg) when the screen
   *  declares `searchPlaceholder`; otherwise ''. */
  render: (params: any, nav: StackNav, filter: string) => ReactNode
  /** Footer left-pill slot (mirrors PreviewOverlay.footer). */
  footer?: ReactNode | ((params: any, nav: StackNav) => ReactNode)
  /** Footer right-pill slot — the success/confirm action (mirrors rightFooter). */
  rightFooter?: ReactNode | ((params: any, nav: StackNav) => ReactNode)
  /** Header overflow slot left of the X (mirrors headerActions). */
  headerActions?: ReactNode | ((params: any, nav: StackNav) => ReactNode)
  /** Header LEADING slot — left of the title (e.g. an ellipsis menu). Honored by
   *  shells that render it (the provider pane); others ignore it. */
  headerLeft?: ReactNode | ((params: any, nav: StackNav) => ReactNode)
  /** Override the default back (default: pop when depth>1, hidden at root). */
  onBack?: (nav: StackNav) => void
  /** Per-screen card width override (else the OverlayStack-level value). */
  maxWidth?: number | string
  /** Per-screen scroll height override (else the OverlayStack-level value). */
  previewMaxHeight?: string
}

/**
 * Live nav of the nearest enclosing OverlayStack, or null when not inside one.
 * Leaves read this to decide morph-in-place (nav present) vs their own nested
 * overlay fallback (null — standalone form, or inside a plain PreviewOverlay).
 */
export const StackNavContext = createContext<StackNav | null>(null)
