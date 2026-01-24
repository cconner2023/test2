import { type IconConfig } from "../Data/IconConfig";

interface SvgIconProps {
    iconConfig: IconConfig;
    className?: string;
    width?: number | string;    // CSS width (px, rem, etc.)
    height?: number | string;   // CSS height
    color?: string;
    style?: React.CSSProperties;
}

export function SvgIcon({
    iconConfig,
    className = "",
    width,
    height,
    color = "currentColor",
    style = {}
}: SvgIconProps) {
    const { svg } = iconConfig;
    const paths = Array.isArray(svg.pathData) ? svg.pathData : [svg.pathData];

    // Build inline styles
    const inlineStyles: React.CSSProperties = {
        ...style,
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
    };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={svg.viewBox}
            fill={svg.fill || "none"}
            stroke={svg.stroke || color}
            strokeWidth={svg.strokeWidth || 2}
            strokeLinecap={svg.strokeLinecap || "round"}
            strokeLinejoin={svg.strokeLinejoin || "round"}
            className={className}
            style={inlineStyles}
        >
            {paths.map((path, index) => (
                <path key={index} d={path} />
            ))}
        </svg>
    );
}