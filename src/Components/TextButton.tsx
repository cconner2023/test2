// components/TextButton.tsx
export interface TextButtonProps {
    text?: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'special' | 'dispo-specific' | 'mobile';
    className?: string;
    isMobile?: boolean
}

export function TextButton({
    text,
    onClick,
    variant = 'primary',
    className = '',
    isMobile = false
}: TextButtonProps) {
    const getVariant = () => {
        switch (variant) {
            case 'secondary':
                return 'bg-themewhite2 text-themeblue3 hover:bg-themeblue1/20 rounded-full';
            case 'primary':
                return 'bg-themeblue3 text-themewhite2 hover:bg-themeblue3/80 rounded-full';
            case 'special':
                return 'bg-themeblue3 text-white hover:bg-themeblue3/80 rounded-full';
            case 'dispo-specific':
                return className;
            case 'mobile':
                return className;
            default:
                return 'bg-themeblue3 text-themewhite2 hover:bg-themeblue3/80';
        }
    };

    return (
        <button
            className={`${isMobile ? '' : 'h-7 p-4'} w-max flex items-center justify-center text-[9pt] font-normal transition-colors duration-200 ${getVariant()} ${variant !== 'dispo-specific' ? className : ''}`}
            onClick={onClick}
        >
            <span>{text}</span>
        </button>
    );
}