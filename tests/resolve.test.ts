import { beforeAll, describe, expect, it } from 'vitest';
import { loadTokens, type TokenFile } from '../src/tokens/load.js';
import {
  defaultTheme,
  flattenPrimitives,
  primitiveCssVar,
  resolveToken,
  selectThemes,
  semanticTokens,
} from '../src/tokens/resolve.js';
import { closestNames } from '../src/tokens/suggest.js';

let tokens: TokenFile;
beforeAll(async () => {
  tokens = await loadTokens('fixtures/tokens.json');
});

describe('resolveToken', () => {
  it('resolves a semantic token in every theme when none is given', () => {
    expect(resolveToken(tokens, 'accent-default')).toEqual({
      name: 'accent-default',
      kind: 'semantic',
      cssVar: '--accent-default',
      values: [
        { theme: 'light', value: '#195e51', chain: ['accent-default', 'color.teal.700', '#195e51'] },
        { theme: 'dark', value: '#4fb39d', chain: ['accent-default', 'color.teal.400', '#4fb39d'] },
      ],
    });
  });

  it('resolves a semantic token in one theme', () => {
    const { values } = resolveToken(tokens, 'accent-default', 'dark');
    expect(values.map((value) => value.theme)).toEqual(['dark']);
  });

  it('returns a CSS variable for a non-color primitive', () => {
    expect(resolveToken(tokens, 'space.4')).toEqual({
      name: 'space.4',
      kind: 'primitive',
      cssVar: '--space-4',
      values: [{ value: '1rem', chain: ['space.4', '1rem'] }],
    });
  });

  it('returns a null CSS variable and usedBy per theme for a primitive color', () => {
    const token = resolveToken(tokens, 'color.teal.700');
    expect(token.cssVar).toBeNull();
    expect(token.usedBy).toEqual({ light: ['accent-default', 'accent-text'], dark: [] });
  });

  it('limits usedBy to the requested theme', () => {
    expect(resolveToken(tokens, 'color.teal.400', 'dark').usedBy).toEqual({ dark: ['accent-default', 'focus-ring'] });
  });

  it('suggests the closest names for an unknown token', () => {
    expect(() => resolveToken(tokens, 'accent-defualt')).toThrow(
      /^Unknown token "accent-defualt"\. Closest names: accent-default, /,
    );
    expect(() => resolveToken(tokens, 'teal.700')).toThrow('Closest names: color.teal.700');
  });

  it('treats inherited object keys and groups as unknown', () => {
    expect(() => resolveToken(tokens, 'constructor')).toThrow('Unknown token "constructor"');
    expect(() => resolveToken(tokens, 'color.teal')).toThrow('Closest names: color.teal.');
  });

  it('lists the themes for an unknown theme', () => {
    expect(() => resolveToken(tokens, 'accent-default', 'sepia')).toThrow(
      'Unknown theme "sepia". Available themes: light, dark.',
    );
    expect(() => resolveToken(tokens, 'accent-default', 'constructor')).toThrow('Unknown theme "constructor"');
  });
});

describe('primitiveCssVar', () => {
  it.each([
    ['space.4', '--space-4'],
    ['radius.md', '--radius-md'],
    ['font.size.0', '--font-size-0'],
    ['font.size.-1', '--font-size--1'],
    ['color.teal.700', null],
    ['colorful.one', '--colorful-one'],
  ])('maps %s to %s', (path, expected) => {
    expect(primitiveCssVar(path)).toBe(expected);
  });
});

describe('flattenPrimitives and semanticTokens', () => {
  it('flattens nested primitives to dotted paths', () => {
    expect(flattenPrimitives(tokens.primitive)).toContainEqual({ path: 'font.weight.bold', value: '700' });
  });

  it('returns each semantic token with its value and primitive', () => {
    expect(semanticTokens(tokens, 'light')).toContainEqual({
      name: 'text-muted',
      value: '#5e594d',
      primitive: 'color.neutral.600',
    });
  });
});

describe('theme selection', () => {
  const withThemes = (...themes: string[]): TokenFile => ({
    primitive: {},
    semantic: Object.fromEntries(themes.map((theme) => [theme, {}])),
    contrastPairs: [],
  });

  it('selects every theme when none is given', () => {
    expect(selectThemes(withThemes('light', 'dark'))).toEqual(['light', 'dark']);
  });

  it('defaults to light when present', () => {
    expect(defaultTheme(withThemes('dark', 'light'))).toBe('light');
  });

  it('defaults to the only theme when there is one', () => {
    expect(defaultTheme(withThemes('brand'))).toBe('brand');
  });

  it('lists the themes when there is no light theme to default to', () => {
    expect(() => defaultTheme(withThemes('dusk', 'dawn'))).toThrow('Pass theme as one of: dusk, dawn.');
  });
});

describe('closestNames', () => {
  const names = ['text-primary', 'text-muted', 'surface-base', 'color.teal.700'];

  it('ranks names containing the query first', () => {
    expect(closestNames('text', names)[0]).toMatch(/^text-/);
    expect(closestNames('TEAL', names)[0]).toBe('color.teal.700');
  });

  it('ranks typos by edit distance', () => {
    expect(closestNames('text-mutd', names)[0]).toBe('text-muted');
  });

  it('respects the limit', () => {
    expect(closestNames('x', names, 2)).toHaveLength(2);
  });
});
