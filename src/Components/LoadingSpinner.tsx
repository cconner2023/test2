import { memo } from 'react'

interface LoadingSpinnerProps {
  /** 'sm' = 20px, 'md' = 32px, 'lg' = 64px */
  size?: 'sm' | 'md' | 'lg'
  /** Optional label shown below the spinner */
  label?: string
  /** Additional CSS classes for the wrapper div */
  className?: string
}

const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-16 h-16' }

/** Spinning Star of Life — shared loading indicator */
export const LoadingSpinner = memo(function LoadingSpinner({ size = 'md', label, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg className={`${sizes[size]} animate-spin`} style={{ animationDuration: '2s' }} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(20,20)">
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" />
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(60)" />
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(120)" />
        </g>
      </svg>
      {label && <p className="mt-2 text-sm text-tertiary/60">{label}</p>}
    </div>
  )
})
