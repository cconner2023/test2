interface ErrorPillProps {
  children: React.ReactNode
  className?: string
}

export function ErrorPill({ children, className = '' }: ErrorPillProps) {
  return (
    <p className={`text-[10pt] font-medium text-themeredred bg-themeredred/5 rounded-full px-4 py-1.5 text-center ${className}`}>
      {children}
    </p>
  )
}
