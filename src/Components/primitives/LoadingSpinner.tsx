import { memo } from 'react'
import { HudLoader } from './HudLoader'

interface LoadingSpinnerProps {
  /** 'sm' = 28px, 'md' = 44px, 'lg' = 72px */
  size?: 'sm' | 'md' | 'lg'
  /** Optional label shown below the spinner */
  label?: string
  /** Additional CSS classes for the wrapper div */
  className?: string
}

// HUD loader needs room to read — bump the legacy 20/32/64 px floors slightly.
const sizes = { sm: 28, md: 44, lg: 72 }

/** Shared loading indicator — the sci-fi HUD loader (Star of Life at center).
 *  Stands still and breathes (no spin on the mark); the orbits/sweeps rotate. */
export const LoadingSpinner = memo(function LoadingSpinner({ size = 'md', label, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <HudLoader size={sizes[size]} />
      {label && <p className="mt-2 text-[10pt] text-tertiary">{label}</p>}
    </div>
  )
})
