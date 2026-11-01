import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findTokenPath } from '../src/config.js';

describe('findTokenPath', () => {
  it('prefers the first CLI argument', () => {
    expect(findTokenPath(['from-arg.json'], { DESIGN_TOKENS_PATH: 'from-env.json' })).toBe(resolve('from-arg.json'));
  });

  it('falls back to DESIGN_TOKENS_PATH', () => {
    expect(findTokenPath([], { DESIGN_TOKENS_PATH: 'from-env.json' })).toBe(resolve('from-env.json'));
  });

  it('explains what to do when neither is set', () => {
    expect(() => findTokenPath([], {})).toThrow('Pass its path as the first argument or set DESIGN_TOKENS_PATH.');
  });
});
