// Stage geometry. The art layer is an SVG in absolute stage pixels; the
// character and props are drawn in a 100-unit space and placed with a single
// translate+scale, so the same rig works at both aspect ratios.

export const LAYOUTS = {
  '9x16': {
    id: '9x16',
    w: 1080,
    h: 1920,
    groundY: 1512,
    scale: 4.3,
    charGroundX: 520,
    card: { x: 540, y: 742, w: 900, h: 344 },
    hook: { x: 540, y: 236, size: 74, align: 'center' },
    wordmark: { x: 540, y: 108, size: 40, align: 'center' },
    dots: { x: 540, y: 1168 },
    end: { x: 540, y: 520, headSize: 62, logo: 128 },
  },
  '16x9': {
    id: '16x9',
    w: 1920,
    h: 1080,
    groundY: 944,
    scale: 3.7,
    charGroundX: 600,
    card: { x: 1056, y: 232, w: 792, h: 118, gap: 22 },
    stack: true,
    hook: { x: 128, y: 168, size: 56, align: 'left' },
    wordmark: { x: 1800, y: 76, size: 32, align: 'right' },
    dots: null,
    end: { x: 1430, y: 300, headSize: 54, logo: 108 },
  },
};

export function layoutFor(ratio) {
  return LAYOUTS[ratio] || LAYOUTS['9x16'];
}
