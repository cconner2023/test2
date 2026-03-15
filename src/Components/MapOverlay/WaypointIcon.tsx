import type { WaypointType } from '../../Types/MapOverlayTypes';
import { WAYPOINT_LABELS } from '../../Types/MapOverlayTypes';

interface WaypointIconProps {
  type: WaypointType;
  color: string;
  size?: number;
  selected?: boolean;
}

function darkenColor(hex: string): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
  return `rgb(${r},${g},${b})`;
}

function abbreviation(label: string): string {
  return label.length > 4 ? label.slice(0, 3) : label;
}

function fontSize(text: string, size: number): number {
  if (text.length <= 2) return size * 0.4;
  if (text.length <= 3) return size * 0.34;
  return size * 0.28;
}

export function WaypointIcon({ type, color, size = 32, selected = false }: WaypointIconProps) {
  const label = WAYPOINT_LABELS[type];
  const abbr = abbreviation(label);
  const textSize = fontSize(abbr, size);
  const center = size / 2;
  const radius = size * 0.42;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {selected && (
        <circle
          cx={center}
          cy={center}
          r={radius + 3}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.6}
        >
          <animate
            attributeName="r"
            values={`${radius + 2};${radius + 5};${radius + 2}`}
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0.2;0.6"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill={color}
        stroke={darkenColor(color)}
        strokeWidth={1.5}
      />
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontWeight="bold"
        fontSize={textSize}
        fontFamily="system-ui, sans-serif"
      >
        {abbr}
      </text>
    </svg>
  );
}
