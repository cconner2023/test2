import { Grid3X3 } from 'lucide-react';
import { PreviewOverlay } from '../PreviewOverlay';
import { useMapPrefsStore } from '../../stores/useMapPrefsStore';
import type { BearingReference } from '../../lib/declination';
import type { CoordDisplay } from '../../stores/useMapPrefsStore';

interface MapSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}

interface MapSettingsBodyProps {
  showGrid: boolean;
  onToggleGrid: () => void;
}

export function MapSettingsBody({ showGrid, onToggleGrid }: MapSettingsBodyProps) {
  const bearingReference = useMapPrefsStore(s => s.bearingReference);
  const setBearingReference = useMapPrefsStore(s => s.setBearingReference);
  const coordDisplay = useMapPrefsStore(s => s.coordDisplay);
  const setCoordDisplay = useMapPrefsStore(s => s.setCoordDisplay);

  const BEARING_REFS: { value: BearingReference; label: string; sub: string }[] = [
    { value: 'true', label: 'True', sub: 'T' },
    { value: 'grid', label: 'Grid', sub: 'G' },
    { value: 'magnetic', label: 'Magnetic', sub: 'M' },
  ];

  const COORD_DISPLAYS: { value: CoordDisplay; label: string }[] = [
    { value: 'mgrs', label: 'MGRS' },
    { value: 'utm', label: 'UTM' },
    { value: 'latlng', label: 'Lat/Lng' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
        {/* Grid toggle row */}
        <div className="flex items-center justify-between rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-themewhite flex items-center justify-center text-tertiary">
              <Grid3X3 size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">MGRS grid</p>
              <p className="text-[10pt] text-tertiary truncate">Overlay coordinate grid</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleGrid}
            aria-pressed={showGrid}
            className={`shrink-0 w-11 h-6 rounded-full relative transition-colors duration-200
              ${showGrid ? 'bg-themeblue3' : 'bg-tertiary/20'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-themewhite shadow-sm transition-all duration-200
                ${showGrid ? 'left-[1.375rem]' : 'left-0.5'}`}
            />
          </button>
        </div>

        {/* Bearing reference selector */}
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-primary">Bearing reference</p>
            <span className="text-[10pt] font-mono text-tertiary">{bearingReference[0].toUpperCase()}</span>
          </div>
          <div className="flex rounded-lg bg-themewhite p-0.5">
            {BEARING_REFS.map(({ value, label, sub }) => {
              const active = bearingReference === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBearingReference(value)}
                  aria-pressed={active}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11pt] font-medium transition-colors
                    ${active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                >
                  {label}
                  <span className="ml-1 font-mono text-[9pt] opacity-60">{sub}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10pt] text-tertiary">
            {bearingReference === 'true' && 'Bearings reference geographic north.'}
            {bearingReference === 'grid' && 'Bearings reference UTM grid north (corrected for convergence).'}
            {bearingReference === 'magnetic' && 'Bearings reference magnetic north (WMM, current epoch).'}
          </p>
        </div>

        {/* Coord display selector */}
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
          <p className="text-sm font-medium text-primary mb-2">Coordinate display</p>
          <div className="flex rounded-lg bg-themewhite p-0.5">
            {COORD_DISPLAYS.map(({ value, label }) => {
              const active = coordDisplay === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCoordDisplay(value)}
                  aria-pressed={active}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11pt] font-medium transition-colors
                    ${active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10pt] text-tertiary">
            Format used for the on-map readout pill. The detail overlay always shows all formats.
          </p>
        </div>
      </div>
  );
}

export function MapSettingsDrawer({
  isOpen,
  onClose,
  showGrid,
  onToggleGrid,
}: MapSettingsDrawerProps) {
  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      title="Map Settings"
      maxWidth={380}
    >
      <MapSettingsBody showGrid={showGrid} onToggleGrid={onToggleGrid} />
    </PreviewOverlay>
  );
}

export default MapSettingsDrawer;
