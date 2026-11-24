import type { ReactNode } from 'react'
import { LoginArt } from './LoginArt'

export const AUTH_CARD = 'rounded-2xl bg-themewhite2/70 backdrop-blur-md border border-primary/6 overflow-hidden'

/** Full-screen contour/network art with fog, fading into the page bg. */
export function AuthBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden bg-themewhite2 dark:bg-themewhite pointer-events-none ${className}`}>
      <LoginArt className="absolute inset-0 w-full h-full" fade="bottom" fog fogClassName="text-themewhite dark:text-themewhite3" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-b from-transparent to-themewhite dark:to-themewhite3" />
    </div>
  )
}

export function ScreenTitle({ title, subtitle, className = '' }: { title?: string; subtitle?: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 max-w-full ${className}`}>
      {title && <h1 className="text-[24pt] leading-tight font-semibold italic tracking-tight text-primary">{title}</h1>}
      {subtitle && <p className="mt-1 text-[10pt] italic text-secondary">{subtitle}</p>}
    </div>
  )
}

/** The three-bar mark, sized by the caller. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="translate(20,20)">
        <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" />
        <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(60)" />
        <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(120)" />
      </g>
    </svg>
  )
}

/** Centered mark + title block shared by the login and lock screens. */
export function AuthHeader({ title, subtitle, small = false, className = '' }: { title?: string; subtitle?: ReactNode; small?: boolean; className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <BrandMark className={`mb-2 transition-all duration-300 ease-out ${small ? 'w-10 h-10' : 'w-16 h-16'}`} />
      <ScreenTitle title={title} subtitle={subtitle} />
    </div>
  )
}
