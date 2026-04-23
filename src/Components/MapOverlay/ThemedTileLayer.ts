import L from 'leaflet';
import type { ThemeName, ThemeMode } from '../../Utilities/ThemeContext';

type RGB = [number, number, number];

export interface TileTheme {
  /** Light pixels (land, open areas) map to this color */
  background: RGB;
  /** Dark pixels (roads, labels, boundaries) map to this color */
  foreground: RGB;
  /** Mid-range pixels (water, parks, features) map to this color */
  accent: RGB;
}

const TILE_THEMES: Record<`${ThemeName}-${ThemeMode}`, TileTheme> = {
  'default-light':    { background: [238, 241, 245], foreground: [8,   18,  28 ], accent: [88,  128, 152] },
  'default-dark':     { background: [14,  22,  32 ], foreground: [232, 242, 250], accent: [45,  90,  118] },

  'ironclad-light':   { background: [248, 242, 225], foreground: [38,  28,  15 ], accent: [160, 100, 20 ] },
  'ironclad-dark':    { background: [30,  26,  20 ], foreground: [215, 205, 188], accent: [180, 120, 35 ] },

  'forest-light':     { background: [240, 244, 238], foreground: [12,  22,  12 ], accent: [40,  120, 85 ] },
  'forest-dark':      { background: [14,  16,  14 ], foreground: [205, 220, 205], accent: [50,  145, 105] },

  'void-light':       { background: [238, 242, 248], foreground: [10,  12,  22 ], accent: [0,   100, 140] },
  'void-dark':        { background: [10,  12,  16 ], foreground: [195, 218, 235], accent: [0,   140, 175] },

  'slipstream-light': { background: [242, 244, 240], foreground: [10,  18,  28 ], accent: [55,  105, 95 ] },
  'slipstream-dark':  { background: [14,  18,  22 ], foreground: [205, 220, 230], accent: [70,  130, 118] },

  'urban-light':      { background: [244, 240, 232], foreground: [28,  20,  12 ], accent: [110, 80,  55 ] },
  'urban-dark':       { background: [14,  13,  11 ], foreground: [218, 208, 192], accent: [130, 98,  76 ] },
};

export function getTileTheme(name: ThemeName, mode: ThemeMode): TileTheme {
  return TILE_THEMES[`${name}-${mode}`] ?? TILE_THEMES[`default-${mode}`];
}

// Backward-compat aliases
export const TILE_THEME_LIGHT: TileTheme = TILE_THEMES['default-light'];
export const TILE_THEME_DARK: TileTheme  = TILE_THEMES['default-dark'];

const TILE_SUBDOMAINS = ['a', 'b', 'c'];

type TileCacheFn = (z: number, x: number, y: number) => Promise<Blob | null>;

const ThemedGridLayer = L.GridLayer.extend({
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    tileTheme: TILE_THEME_LIGHT as TileTheme,
    tileCache: null as TileCacheFn | null,
  },

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement {
    const tile = document.createElement('canvas');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;

    const ctx = tile.getContext('2d');
    if (!ctx) {
      done(new Error('Canvas context unavailable'), tile);
      return tile;
    }

    const colors = this.options.tileTheme as TileTheme;
    const tileCache = this.options.tileCache as TileCacheFn | null;

    const sub = TILE_SUBDOMAINS[Math.abs(coords.x + coords.y) % TILE_SUBDOMAINS.length];
    const networkUrl = `https://${sub}.tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;

    const renderFromSource = (src: string, isObjectUrl: boolean) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;

      img.onload = () => {
        if (isObjectUrl) URL.revokeObjectURL(src);
        ctx.drawImage(img, 0, 0, size.x, size.y);
        try {
          const imageData = ctx.getImageData(0, 0, size.x, size.y);
          recolorPixels(imageData.data, colors);
          ctx.putImageData(imageData, 0, 0);
        } catch {
          // CORS tainted canvas — show the uncolored tile rather than blank
        }
        done(undefined, tile);
      };

      img.onerror = () => {
        if (isObjectUrl) URL.revokeObjectURL(src);
        ctx.fillStyle = `rgb(${colors.background[0]},${colors.background[1]},${colors.background[2]})`;
        ctx.fillRect(0, 0, size.x, size.y);
        done(undefined, tile);
      };
    };

    if (tileCache) {
      tileCache(coords.z, coords.x, coords.y)
        .then((blob) => {
          if (blob) {
            renderFromSource(URL.createObjectURL(blob), true);
          } else {
            renderFromSource(networkUrl, false);
          }
        })
        .catch(() => renderFromSource(networkUrl, false));
    } else {
      renderFromSource(networkUrl, false);
    }

    return tile;
  },
});

function recolorPixels(data: Uint8ClampedArray, colors: TileTheme): void {
  const { background: bg, foreground: fg, accent: ac } = colors;

  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;

    let r: number, g: number, b: number;

    if (lum < 0.42) {
      // Dark pixels (text, road outlines, labels) → foreground.
      // OSM text is typically #333–#555 (lum 0.20–0.35), not pure black —
      // the old 0.10 threshold was too low and mapped those to accent.
      const t = lum / 0.42;
      r = fg[0] + (ac[0] - fg[0]) * t * 0.20;
      g = fg[1] + (ac[1] - fg[1]) * t * 0.20;
      b = fg[2] + (ac[2] - fg[2]) * t * 0.20;
    } else if (lum < 0.62) {
      // Anti-aliasing / mid-tones → blend fg → ac
      const t = (lum - 0.42) / 0.20;
      r = fg[0] + (ac[0] - fg[0]) * (0.20 + t * 0.80);
      g = fg[1] + (ac[1] - fg[1]) * (0.20 + t * 0.80);
      b = fg[2] + (ac[2] - fg[2]) * (0.20 + t * 0.80);
    } else {
      // Light pixels (land, buildings, roads) → accent to background
      const t = (lum - 0.62) / 0.38;
      r = ac[0] + (bg[0] - ac[0]) * t;
      g = ac[1] + (bg[1] - ac[1]) * t;
      b = ac[2] + (bg[2] - ac[2]) * t;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

export function createThemedTileLayer(
  tileTheme: TileTheme,
  tileCache?: TileCacheFn | null,
): L.GridLayer {
  return new ThemedGridLayer({ tileTheme, tileCache: tileCache ?? null });
}
