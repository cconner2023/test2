/** Centralized timing and layout constants used across the app */

/** Scroll/animation delays for algorithm page transitions */
export const ALGORITHM_TIMING = {
    /** Delay before scrolling after connector stagger animation completes (ms) */
    SCROLL_AFTER_STAGGER: 550,
    /** Delay before scrolling after disposition change (ms) */
    DISPOSITION_SCROLL_DELAY: 600,
    /** Delay for initial algorithm load scroll (ms) */
    INITIAL_SCROLL_DELAY: 300,
    /** Retry delay when marker/container not ready (ms) */
    SCROLL_RETRY: 50,
} as const;

/** BaseDrawer animation timing */
export const DRAWER_TIMING = {
    /** Main transition duration (ms) — matches CSS transition-duration */
    TRANSITION: 300,
    /** Delay before triggering open state to allow initial frame render (ms) */
    OPEN_DELAY: 10,
    /** Delay after close animation before unmounting (ms) */
    CLOSE_UNMOUNT_DELAY: 50,
} as const;

/** General UI feedback timing */
export const UI_TIMING = {
    FEEDBACK_DURATION: 2500,   // toast/modal auto-dismiss
    COPY_FEEDBACK: 2000,       // copy button reset
    DELETE_CONFIRM_TIMEOUT: 5000, // delete confirmation auto-reset
    SLIDE_ANIMATION: 300,      // slide transition duration
    AUTOFOCUS_DELAY: 100,      // input focus delays
    SAVE_ERROR_DURATION: 3000, // save error feedback display time
    AFTER_SAVE_DELAY: 800,     // delay before after-save callback
    OFFLINE_TOAST_DURATION: 3000, // offline notification display time
} as const;
