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
  background: [240, 242, 245],   // themewhite2
  foreground: [0, 66, 92],       // themeblue3
  accent: [129, 161, 181],       // themeblue1
};

export const TILE_THEME_DARK: TileTheme = {
  background: [15, 25, 35],      // themewhite (dark)
  foreground: [129, 161, 181],   // themeblue1
  accent: [0, 66, 92],           // themeblue3
};

const TILE_SUBDOMAINS = ['a', 'b', 'c'];

const ThemedGridLayer = L.GridLayer.extend({
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    tileTheme: TILE_THEME_LIGHT as TileTheme,
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

    const sub = TILE_SUBDOMAINS[Math.abs(coords.x + coords.y) % TILE_SUBDOMAINS.length];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://${sub}.tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;

    const colors = this.options.tileTheme as TileTheme;

    img.onload = () => {
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
      ctx.fillStyle = colors.background
        ? `rgb(${colors.background[0]},${colors.background[1]},${colors.background[2]})`
        : '#f0f2f5';
      ctx.fillRect(0, 0, size.x, size.y);
      done(undefined, tile);
    };

    return tile;
  },
});

function recolorPixels(data: Uint8ClampedArray, colors: TileTheme): void {
  const { background: bg, foreground: fg, accent: ac } = colors;

  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;

    let r: number, g: number, b: number;

    if (lum < 0.35) {
      // Dark pixels → foreground to accent
      const t = lum / 0.35;
      r = fg[0] + (ac[0] - fg[0]) * t;
      g = fg[1] + (ac[1] - fg[1]) * t;
      b = fg[2] + (ac[2] - fg[2]) * t;
    } else if (lum < 0.65) {
      // Mid-range → accent
      const t = (lum - 0.35) / 0.3;
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

export function createThemedTileLayer(tileTheme: TileTheme): L.GridLayer {
  return new ThemedGridLayer({ tileTheme });
}
