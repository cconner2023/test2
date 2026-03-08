/**
 * Shared body silhouette SVG component for TC3 body diagram.
 *
 * Extracted from BodyDiagram.tsx and TC3WriteNote.tsx to eliminate
 * duplicated SVG path data across both files.
 *
 * Used by:
 * - BodyDiagram.tsx (interactive, clickable body panel)
 * - TC3WriteNote.tsx (read-only export body panel)
 */
import type { BodySide } from '../../Types/TC3Types'

interface BodySilhouetteProps {
  side: BodySide
  /** Additional className applied to the root <svg> element. */
  className?: string
}

/**
 * Renders the body outline SVG paths for front or back view.
 * Does not include any interactive elements or injury markers —
 * those are layered on top by the consuming component.
 */
export function BodySilhouette({ side, className = 'w-full h-full' }: BodySilhouetteProps) {
  return (
    <svg
      viewBox="0 0 200 400"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Head */}
      <ellipse cx="100" cy="35" rx="22" ry="28" />
      {/* Neck */}
      <line x1="92" y1="62" x2="92" y2="75" />
      <line x1="108" y1="62" x2="108" y2="75" />

      {/* Torso */}
      {side === 'front' ? (
        <path d="M70 75 L60 85 L55 140 L60 200 L75 210 L80 200 L100 205 L120 200 L125 210 L140 200 L145 140 L140 85 L130 75 Z" />
      ) : (
        <>
          <path d="M70 75 L60 85 L55 140 L58 200 L75 215 L100 210 L125 215 L142 200 L145 140 L140 85 L130 75 Z" />
          {/* Spine line */}
          <line x1="100" y1="75" x2="100" y2="200" strokeDasharray="4 3" opacity="0.4" />
          {/* Buttocks line */}
          <path d="M75 215 Q100 225 125 215" strokeDasharray="3 3" opacity="0.3" />
        </>
      )}

      {/* Left arm */}
      <path d="M60 85 L40 120 L30 170 L25 200 L30 205 L38 200 L45 170 L55 140" />
      {/* Right arm */}
      <path d="M140 85 L160 120 L170 170 L175 200 L170 205 L162 200 L155 170 L145 140" />

      {/* Left leg */}
      {side === 'front' ? (
        <path d="M75 210 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 205" />
      ) : (
        <path d="M75 215 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 210" />
      )}

      {/* Right leg */}
      {side === 'front' ? (
        <path d="M125 210 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 205" />
      ) : (
        <path d="M125 215 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 210" />
      )}
    </svg>
  )
}
