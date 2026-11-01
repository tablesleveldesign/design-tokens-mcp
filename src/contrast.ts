export type Grade = 'AAA' | 'AA' | 'AA large' | 'fail';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function linearChannel(hexPair: string): number {
  const channel = Number.parseInt(hexPair, 16) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a `#rrggbb` color. */
export function relativeLuminance(hex: string): number {
  const red = linearChannel(hex.slice(1, 3));
  const green = linearChannel(hex.slice(3, 5));
  const blue = linearChannel(hex.slice(5, 7));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2.x contrast ratio, from 1 to 21. The order of the two colors doesn't matter. */
export function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05);
}

/** Grades the exact ratio, not the rounded one, so 4.496 displays as 4.50 but doesn't earn AA. */
export function gradeContrast(ratio: number): Grade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'fail';
}

export function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}
