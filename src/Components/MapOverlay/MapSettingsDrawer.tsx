import { Grid3X3, Tag, Compass, MapPin } from 'lucide-react';
import { PreviewOverlay } from '../PreviewOverlay';
import { useMapPrefsStore } from '../../stores/useMapPrefsStore';
import type { BearingReference } from '../../lib/declination';
import type { CoordDisplay, LabelMode } from '../../stores/useMapPrefsStore';

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
  const labelMode = useMapPrefsStore(s => s.labelMode);
  const setLabelMode = useMapPrefsStore(s => s.setLabelMode);

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
        <div data-tour="map-settings-grid-toggle" className="flex items-center justify-between rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
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

        {/* Bearing reference — icon row + compact right-aligned pill */}
        <div data-tour="map-settings-bearing-ref" className="flex items-center justify-between rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-themewhite flex items-center justify-center text-tertiary">
              <Compass size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Bearing reference</p>
              <p className="text-[10pt] text-tertiary truncate">
                {bearingReference === 'true' && 'Geographic north'}
                {bearingReference === 'grid' && 'UTM grid north'}
                {bearingReference === 'magnetic' && 'Magnetic north (WMM)'}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex rounded-lg bg-themewhite p-0.5">
            {BEARING_REFS.map(({ value, sub }) => {
              const active = bearingReference === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBearingReference(value)}
                  aria-pressed={active}
                  aria-label={value}
                  className={`w-7 h-7 rounded-md font-mono text-[10pt] font-semibold transition-colors
                    ${active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>

        {/* Coordinate display — icon row + compact right-aligned pill */}
        <div data-tour="map-settings-coord-display" className="flex items-center justify-between rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-themewhite flex items-center justify-center text-tertiary">
              <MapPin size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Coordinate display</p>
              <p className="text-[10pt] text-tertiary truncate">Readout pill format</p>
            </div>
          </div>
          <div className="shrink-0 flex rounded-lg bg-themewhite p-0.5">
            {COORD_DISPLAYS.map(({ value, label }) => {
              const active = coordDisplay === value;
              const short = value === 'latlng' ? 'LL' : label;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCoordDisplay(value)}
                  aria-pressed={active}
                  aria-label={label}
                  className={`px-2 h-7 rounded-md font-mono text-[10pt] font-semibold transition-colors
                    ${active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </div>

        {/* Always-on labels toggle — off = labels only on selected feature */}
        <div data-tour="map-settings-label-mode" className="flex items-center justify-between rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-themewhite flex items-center justify-center text-tertiary">
              <Tag size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Always show labels</p>
              <p className="text-[10pt] text-tertiary truncate">Off: only the selected feature</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLabelMode(labelMode === 'always' ? 'selected' : 'always')}
            aria-pressed={labelMode === 'always'}
            className={`shrink-0 w-11 h-6 rounded-full relative transition-colors duration-200
              ${labelMode === 'always' ? 'bg-themeblue3' : 'bg-tertiary/20'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-themewhite shadow-sm transition-all duration-200
                ${labelMode === 'always' ? 'left-[1.375rem]' : 'left-0.5'}`}
            />
          </button>
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
