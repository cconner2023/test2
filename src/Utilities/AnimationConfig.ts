// Utilities/AnimationConfig.ts - Centralized animation configuration
import { useAutoAnimate } from '@formkit/auto-animate/react'
import type { AutoAnimateOptions } from '@formkit/auto-animate'

/**
 * Standard animation configurations for consistent UX across the app
 */
export const ANIMATION_CONFIG = {
  // Default smooth animation for most transitions
  default: {
    duration: 300,
    easing: 'ease-in-out',
  } as AutoAnimateOptions,

  // Fast animation for quick interactions
  fast: {
    duration: 200,
    easing: 'ease-in-out',
  } as AutoAnimateOptions,

  // Slow animation for emphasized transitions
  slow: {
    duration: 400,
    easing: 'ease-in-out',
  } as AutoAnimateOptions,
} as const

/**
 * Custom hook for consistent auto-animate behavior
 * @param speed - Animation speed preset ('default', 'fast', or 'slow')
 * @returns Tuple of [ref, enable function] from useAutoAnimate
 */
export function useAppAnimate<T extends HTMLElement>(
  speed: keyof typeof ANIMATION_CONFIG = 'default'
) {
  return useAutoAnimate<T>(ANIMATION_CONFIG[speed])
}
