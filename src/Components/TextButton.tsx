// components/TextButton.tsx
export interface TextButtonProps {
    text?: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'special' | 'dispo-specific';
    className?: string;
}

export function TextButton({
    text,
    onClick,
    variant = 'primary',
    className = '',
}: TextButtonProps) {
    const displayText = text;
    const textButtonClick = onClick;

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
            default:
                return 'bg-themeblue3 text-themewhite2 hover:bg-themeblue3/80';
        }
    };

    return (
        <button
            className={`h-7 w-max flex items-center justify-center p-4 text-sm font-normal transition-all duration-300 ${getVariant()} ${variant !== 'dispo-specific' ? className : ''}`}
            onClick={textButtonClick}
        >
            <span>{displayText}</span>
        </button>
    );
}