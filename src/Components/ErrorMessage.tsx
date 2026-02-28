interface ErrorMessageProps {
    error: string | null
    className?: string
}

export const ErrorMessage = ({ error, className = '' }: ErrorMessageProps) => {
    if (!error) return null
    return (
        <div className={`mb-4 p-3 rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred text-sm text-center ${className}`}>
            {error}
        </div>
    )
}
