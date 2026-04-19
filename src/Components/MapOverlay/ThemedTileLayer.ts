import L from 'leaflet';

type RGB = [number, number, number];

export interface TileTheme {
  /** Light pixels (land, open areas) map to this color */
  background: RGB;
  /** Dark pixels (roads, labels, boundaries) map to this color */
  foreground: RGB;
  /** Mid-range pixels (water, parks, features) map to this color */
  accent: RGB;
}

export const TILE_THEME_LIGHT: TileTheme = {
  background: [238, 241, 245],   // themewhite2
  foreground: [8, 18, 28],       // near-black — crisp text/roads
  accent: [88, 128, 152],        // mid-blue features (water, parks)
};

export const TILE_THEME_DARK: TileTheme = {
  background: [14, 22, 32],      // themewhite (dark)
  foreground: [200, 215, 228],   // near-white — crisp text/roads
  accent: [35, 72, 98],          // deep blue features
};

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

    if (lum < 0.10) {
      // Very dark pixels (text, outlines) → pure foreground for maximum contrast
      r = fg[0]; g = fg[1]; b = fg[2];
    } else if (lum < 0.38) {
      // Anti-aliasing / dark mid-tones → blend fg → ac
      const t = (lum - 0.10) / 0.28;
      r = fg[0] + (ac[0] - fg[0]) * t;
      g = fg[1] + (ac[1] - fg[1]) * t;
      b = fg[2] + (ac[2] - fg[2]) * t;
    } else if (lum < 0.65) {
      // Mid-range → accent to background
      const t = (lum - 0.38) / 0.27;
      r = ac[0] + (bg[0] - ac[0]) * t * 0.3;
      g = ac[1] + (bg[1] - ac[1]) * t * 0.3;
      b = ac[2] + (bg[2] - ac[2]) * t * 0.3;
    } else {
      // Light pixels → accent to background
      const t = (lum - 0.65) / 0.35;
      r = ac[0] + (bg[0] - ac[0]) * (0.3 + t * 0.7);
      g = ac[1] + (bg[1] - ac[1]) * (0.3 + t * 0.7);
      b = ac[2] + (bg[2] - ac[2]) * (0.3 + t * 0.7);
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
