import { memo } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { LoadingSpinner } from './LoadingSpinner'

interface LoadingOverlayProps {
  visible: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export const LoadingOverlay = memo(function LoadingOverlay({
  visible,
  className = '',
  size = 'lg',
}: LoadingOverlayProps) {
  const spring = useSpring({
    opacity: visible ? 1 : 0,
    config: { tension: 200, friction: 22 },
  })
  return (
    <animated.div
      className={`absolute inset-0 z-50 flex items-center justify-center bg-themewhite dark:bg-themewhite ${className}`}
      style={{ opacity: spring.opacity, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <LoadingSpinner size={size} className="text-themeblue2" />
    </animated.div>
  )
})
