import {
  MousePointer,
  MapPin,
  Route,
  Pentagon,
  Locate,
  Save,
  ArrowLeft,
  Check,
  X,
} from 'lucide-react';
import type { DrawMode } from '../../Types/MapOverlayTypes';

interface OverlayToolbarProps {
  drawMode: DrawMode;
  onDrawModeChange: (mode: DrawMode) => void;
  onGPSCenter: () => void;
  onSave: () => void;
  onBack: () => void;
  isDrawing: boolean;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
}

const DRAW_TOOLS: { mode: DrawMode; icon: typeof MousePointer; label: string }[] = [
  { mode: 'pan', icon: MousePointer, label: 'Pan' },
  { mode: 'pin', icon: MapPin, label: 'Drop Pin' },
  { mode: 'route', icon: Route, label: 'Route' },
  { mode: 'edit', icon: Pentagon, label: 'Edit' },
];

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95 shadow-md ${
        active
          ? 'bg-themeblue3 text-white ring-2 ring-themeblue2'
          : 'bg-themewhite/90 dark:bg-themegray/90 text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export function OverlayToolbar({
  drawMode,
  onDrawModeChange,
  onGPSCenter,
  onSave,
  onBack,
  isDrawing,
  onFinishDrawing,
  onCancelDrawing,
}: OverlayToolbarProps) {
  if (isDrawing) {
    return (
      <div className="absolute left-3 top-3 flex flex-col gap-1.5 z-[1000]">
        <ToolButton active onClick={onFinishDrawing} label="Finish drawing">
          <Check size={20} />
        </ToolButton>
        <ToolButton onClick={onCancelDrawing} label="Cancel drawing">
          <X size={20} />
        </ToolButton>
      </div>
    );
  }

  return (
    <div className="absolute left-3 top-3 flex flex-col gap-1.5 z-[1000]">
      {DRAW_TOOLS.map(({ mode, icon: Icon, label }) => (
        <ToolButton
          key={mode}
          active={drawMode === mode}
          onClick={() => onDrawModeChange(mode)}
          label={label}
        >
          <Icon size={20} />
        </ToolButton>
      ))}

      <div className="h-px bg-tertiary/20 my-1" />

      <ToolButton onClick={onGPSCenter} label="Center on GPS">
        <Locate size={20} />
      </ToolButton>
      <ToolButton onClick={onSave} label="Save overlay">
        <Save size={20} />
      </ToolButton>
      <ToolButton onClick={onBack} label="Back">
        <ArrowLeft size={20} />
      </ToolButton>
    </div>
  );
}
