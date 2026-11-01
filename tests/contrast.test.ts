import { describe, expect, it } from 'vitest';
import { contrastRatio, gradeContrast, isHexColor, relativeLuminance, roundRatio } from '../src/contrast.js';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('weights green above red above blue', () => {
    expect(relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance('#ff0000')).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 4);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
  });

  it('is about 4.48 for #777777 on white', () => {
    expect(roundRatio(contrastRatio('#777777', '#ffffff'))).toBe(4.48);
  });

  it('is 1 for a color on itself', () => {
    expect(contrastRatio('#195e51', '#195e51')).toBe(1);
  });

  it('does not depend on the order or the case', () => {
    expect(contrastRatio('#FFFFFF', '#195e51')).toBe(contrastRatio('#195E51', '#ffffff'));
  });
});

describe('gradeContrast', () => {
  it.each([
    [21, 'AAA'],
    [7, 'AAA'],
    [6.99, 'AA'],
    [4.5, 'AA'],
    [4.496, 'AA large'],
    [3, 'AA large'],
    [2.99, 'fail'],
    [1, 'fail'],
  ])('grades %d as %s', (ratio, grade) => {
    expect(gradeContrast(ratio)).toBe(grade);
  });
});

describe('isHexColor', () => {
  it('accepts #rrggbb in either case', () => {
    expect(isHexColor('#195e51')).toBe(true);
    expect(isHexColor('#195E51')).toBe(true);
  });

  it.each(['#fff', '195e51', '#195e5', '#195e51ff', '#gggggg', '1rem'])('rejects %s', (value) => {
    expect(isHexColor(value)).toBe(false);
  });
});
