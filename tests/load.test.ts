import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrimitive, loadTokens, validateTokens } from '../src/tokens/load.js';

const valid = () => ({
  primitive: { color: { neutral: { 50: '#f7f6f3', 900: '#1e1c18' } }, space: { 4: '1rem' } },
  semantic: {
    light: { 'text-primary': '{color.neutral.900}', 'surface-base': '{color.neutral.50}' },
    dark: { 'text-primary': '{color.neutral.50}', 'surface-base': '{color.neutral.900}' },
  },
  contrastPairs: [{ fg: 'text-primary', bg: 'surface-base', min: 4.5 }],
});

describe('validateTokens', () => {
  it('accepts a valid file and ignores unknown top-level keys', () => {
    const tokens = validateTokens({ ...valid(), $description: 'ignored' });
    expect(tokens).toEqual(valid());
  });

  it.each(['primitive', 'semantic', 'contrastPairs'] as const)('names the missing section %s', (section) => {
    const data: Record<string, unknown> = valid();
    delete data[section];
    expect(() => validateTokens(data)).toThrow(`Missing section "${section}"`);
  });

  it('names a reference to a primitive that does not exist', () => {
    const data = valid();
    data.semantic.light['text-primary'] = '{color.neutral.999}';
    expect(() => validateTokens(data)).toThrow(
      'semantic "light.text-primary" references "color.neutral.999", which is not a primitive token.',
    );
  });

  it('rejects a reference to a group of tokens', () => {
    const data = valid();
    data.semantic.light['text-primary'] = '{color.neutral}';
    expect(() => validateTokens(data)).toThrow('references "color.neutral"');
  });

  it('rejects a semantic value that is not a reference', () => {
    const data = valid();
    data.semantic.light['text-primary'] = '#000000';
    expect(() => validateTokens(data)).toThrow('must be a reference like');
  });

  it('names a theme missing a token another theme has', () => {
    const data = valid();
    const semantic = { ...data.semantic, dark: { 'text-primary': '{color.neutral.50}' } };
    expect(() => validateTokens({ ...data, semantic })).toThrow(
      'theme "dark" is missing "surface-base", which another theme defines.',
    );
  });

  it('names a contrast pair that uses an unknown token', () => {
    const data = valid();
    data.contrastPairs[0]!.fg = 'text-nope';
    expect(() => validateTokens(data)).toThrow('contrastPairs[0] uses "text-nope"');
  });

  it('reports every problem at once', () => {
    const data = valid();
    data.semantic.light['text-primary'] = '{color.nope}';
    data.contrastPairs[0]!.bg = 'surface-nope';
    expect(() => validateTokens(data)).toThrow(/color\.nope.*surface-nope/);
  });
});

describe('getPrimitive', () => {
  const { primitive } = valid();

  it('returns the value at a dotted path', () => {
    expect(getPrimitive(primitive, 'color.neutral.50')).toBe('#f7f6f3');
  });

  it('returns undefined for groups, missing paths and inherited object keys', () => {
    expect(getPrimitive(primitive, 'color.neutral')).toBeUndefined();
    expect(getPrimitive(primitive, 'color.teal.700')).toBeUndefined();
    expect(getPrimitive(primitive, 'constructor')).toBeUndefined();
  });
});

describe('loadTokens', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'design-tokens-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true });
  });

  it('loads the fixture', async () => {
    const tokens = await loadTokens('fixtures/tokens.json');
    expect(getPrimitive(tokens.primitive, 'color.teal.700')).toBe('#195e51');
  });

  it('names the file when it cannot be read', async () => {
    await expect(loadTokens(join(dir, 'missing.json'))).rejects.toThrow(/Cannot read token file ".*missing\.json"/);
  });

  it('names the file when the JSON is broken', async () => {
    const path = join(dir, 'broken.json');
    await writeFile(path, '{ nope');
    await expect(loadTokens(path)).rejects.toThrow(/broken\.json" is not valid JSON/);
  });

  it('names the file and the problem when the content is invalid', async () => {
    const path = join(dir, 'invalid.json');
    await writeFile(path, '{}');
    await expect(loadTokens(path)).rejects.toThrow(/invalid\.json" is invalid: Missing section "primitive"/);
  });
});
