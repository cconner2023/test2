import { getIconById, type IconId } from "../Data/IconConfig";
import { SvgIcon } from "./ThemeButtonConfig";

interface ThemeButtonProps {
    iconId: IconId;
    text?: string;
    onClick?: () => void;
    className?: string;
    iconClassName?: string;
    textClassName?: string;
    showTextOnMobile?: boolean;
    iconWidth?: number;    // CSS width in pixels
    iconHeight?: number;   // CSS height in pixels
    iconColor?: string;
}

export function ThemeButton({
    iconId,
    text,
    onClick,
    className = "",
    iconClassName = "",
    textClassName = "",
    showTextOnMobile = false,
    iconWidth,
    iconHeight,
    iconColor = "currentColor"
}: ThemeButtonProps) {
    const iconConfig = getIconById(iconId);

    if (!iconConfig) {
        console.warn(`Icon with ID "${iconId}" not found`);
        return null;
    }

    const displayText = text || iconConfig.defaultText || iconConfig.name;
    const handleClick = onClick || iconConfig.defaultOnClick;

    // Use iconConfig defaults if not overridden
    const finalIconWidth = iconWidth ?? iconConfig.width ?? 24;
    const finalIconHeight = iconHeight ?? iconConfig.height ?? 24;

    return (
        <button
            className={`h-7 w-max flex items-center justify-center bg-themewhite2 lg:px-4 lg:py-4 px-3 py-5 rounded-full gap-2 hover:bg-themeblue1/20 transition-all duration-300 ${className}`}
            onClick={handleClick}
        >
            <SvgIcon
                iconConfig={iconConfig}
                width={finalIconWidth}
                height={finalIconHeight}
                color={iconColor}
                className={`${iconClassName}`}
                style={{ flexShrink: 0 }} // Prevent icon from shrinking
            />
            <span className={`${showTextOnMobile ? 'inline' : 'lg:inline hidden'} text-[10pt] ${textClassName}`}>
                {displayText}
            </span>
        </button>
    );
}