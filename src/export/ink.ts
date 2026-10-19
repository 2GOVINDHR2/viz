/**
 * Print modes for exported figures. Colour uses the app's light-theme
 * tokens; greyscale and high-contrast never rely on hue: series differ by
 * dash pattern, sign by dash or hatching, and every number is in the CSV.
 */
export type PrintMode = 'colour' | 'greyscale' | 'highContrast';
export const PRINT_MODES: { id: PrintMode; label: string }[] = [
  { id: 'colour', label: 'Colour' },
  { id: 'greyscale', label: 'Greyscale' },
  { id: 'highContrast', label: 'High contrast' },
];

export interface Ink {
  text: string;
  muted: string;
  grid: string;
  axis: string;
  /** Fixed-order series colours and their dash patterns (identity never by colour alone). */
  series: [string, string, string];
  dashes: [string, string, string];
  pos: string;
  neg: string;
  stroke: number;
}

export const INK: Record<PrintMode, Ink> = {
  colour: {
    text: '#1b2430',
    muted: '#5b6573',
    grid: '#e3e7ed',
    axis: '#5b6573',
    series: ['#2a78d6', '#863103', '#1baf7a'],
    dashes: ['', '6 3', '2 2'],
    pos: '#0072b2',
    neg: '#d55e00',
    stroke: 1.6,
  },
  greyscale: {
    text: '#000000',
    muted: '#444444',
    grid: '#dddddd',
    axis: '#444444',
    series: ['#000000', '#555555', '#888888'],
    dashes: ['', '6 3', '2 2'],
    pos: '#000000',
    neg: '#777777',
    stroke: 1.6,
  },
  highContrast: {
    text: '#000000',
    muted: '#000000',
    grid: '#999999',
    axis: '#000000',
    series: ['#000000', '#000000', '#000000'],
    dashes: ['', '7 3', '2 2'],
    pos: '#000000',
    neg: '#000000',
    stroke: 2.4,
  },
};

const hex2 = (x: number): string =>
  Math.round(Math.min(255, Math.max(0, x)))
    .toString(16)
    .padStart(2, '0');
const grey = (l: number): string => `#${hex2(l * 255).repeat(3)}`;
const lerp = (a: number[], b: number[], t: number): string =>
  `#${a.map((v, k) => hex2(v + (b[k] - v) * t)).join('')}`;

/**
 * Diverging fill for v in [−1, 1] (signed value over the map's largest magnitude):
 * colour — orange (negative) through near-white to blue (positive), as in the app;
 * greyscale / high contrast — darkness = |v|, and negative cells are hatched.
 */
export function diverging(v: number, mode: PrintMode): { fill: string; hatch: boolean } {
  const t = Math.min(1, Math.abs(v));
  if (mode === 'colour')
    return { fill: lerp([246, 247, 249], v < 0 ? [213, 94, 0] : [0, 114, 178], t), hatch: false };
  return { fill: grey(1 - t * (mode === 'highContrast' ? 0.85 : 0.75)), hatch: v < 0 && t > 0.02 };
}

/** Sequential fill for t in [0, 1]: one hue light → dark (colour), white → black otherwise. */
export function sequential(t: number, mode: PrintMode): string {
  const u = Math.min(1, Math.max(0, t));
  return mode === 'colour' ? lerp([234, 242, 251], [11, 61, 120], u) : grey(1 - 0.9 * u);
}

/** Pixel intensity in [0, 1] (input images): white background, dark ink, in every mode. */
export const pixel = (v: number): string => grey(1 - Math.min(1, Math.max(0, v)));

const luminance = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function parse(c: string): [number, number, number] | null {
  const m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16)) as [number, number, number];
  const r = c.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : null;
}

/** Maps a literal colour in exported markup to the print mode (used for views rendered by the app's own components). */
export function mapColour(c: string, attr: 'fill' | 'stroke', mode: PrintMode): string {
  if (mode === 'colour') return c;
  const rgb = parse(c);
  if (!rgb) return c;
  const l = luminance(...rgb);
  if (mode === 'greyscale') return grey(l);
  return attr === 'stroke' ? '#000000' : grey(0.72 + 0.28 * l);
}
