import { getPrimitive, referencePath, type PrimitiveNode, type TokenFile } from './load.js';
import { closestNames } from './suggest.js';

export interface PrimitiveToken {
  path: string;
  value: string;
}

export interface SemanticToken {
  name: string;
  value: string;
  /** Dotted path of the primitive this token points to. */
  primitive: string;
}

export interface ResolvedValue {
  /** Set for semantic tokens. A primitive has the same value in every theme. */
  theme?: string;
  value: string;
  /** Every step from the requested name to the raw value. */
  chain: string[];
}

export interface ResolvedToken {
  name: string;
  kind: 'semantic' | 'primitive';
  /** Null for primitive colors: the token format generates no `--color-*` variables. */
  cssVar: string | null;
  values: ResolvedValue[];
  /** Primitive colors only: the semantic tokens that point to this color, per theme. */
  usedBy?: Record<string, string[]>;
}

export function themeNames(tokens: TokenFile): string[] {
  return Object.keys(tokens.semantic);
}

function assertTheme(tokens: TokenFile, theme: string): void {
  if (!Object.hasOwn(tokens.semantic, theme)) {
    throw new Error(`Unknown theme "${theme}". Available themes: ${themeNames(tokens).join(', ')}.`);
  }
}

/** The themes to report on: the requested one, or all of them when `theme` is omitted. */
export function selectThemes(tokens: TokenFile, theme?: string): string[] {
  if (theme === undefined) return themeNames(tokens);
  assertTheme(tokens, theme);
  return [theme];
}

/** The theme to list when none is requested: `light`, else the only theme, else an error listing the themes. */
export function defaultTheme(tokens: TokenFile): string {
  const themes = themeNames(tokens);
  if (themes.includes('light')) return 'light';
  if (themes.length === 1) return themes[0] as string;
  throw new Error(`No "light" theme to default to. Pass theme as one of: ${themes.join(', ')}.`);
}

export function flattenPrimitives(primitive: PrimitiveNode, prefix = ''): PrimitiveToken[] {
  return Object.entries(primitive).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [{ path, value }] : flattenPrimitives(value, path);
  });
}

/** Semantic tokens of one theme. The theme must exist. */
export function semanticTokens(tokens: TokenFile, theme: string): SemanticToken[] {
  assertTheme(tokens, theme);
  return Object.entries(tokens.semantic[theme] as Record<string, string>).map(([name, reference]) => {
    const primitive = referencePath(reference) as string;
    return { name, value: getPrimitive(tokens.primitive, primitive) as string, primitive };
  });
}

/** Names of the semantic tokens. Validation guarantees every theme defines the same ones. */
export function semanticNames(tokens: TokenFile): string[] {
  return Object.keys(Object.values(tokens.semantic)[0] ?? {});
}

export function semanticCssVar(name: string): string {
  return `--${name}`;
}

/** Follows the portfolio's naming: `space.4` becomes `--space-4`. Primitive colors have no variable. */
export function primitiveCssVar(path: string): string | null {
  return path === 'color' || path.startsWith('color.') ? null : `--${path.replaceAll('.', '-')}`;
}

function usedBy(tokens: TokenFile, path: string, themes: string[]): Record<string, string[]> {
  return Object.fromEntries(
    themes.map((theme) => [
      theme,
      semanticTokens(tokens, theme)
        .filter((token) => token.primitive === path)
        .map((token) => token.name),
    ]),
  );
}

/** Message for a name that isn't a token, with the closest names so an agent can correct itself. */
export function unknownTokenMessage(name: string, candidates: string[]): string {
  const closest = closestNames(name, candidates);
  const hint = closest.length > 0 ? ` Closest names: ${closest.join(', ')}.` : '';
  return `Unknown token "${name}".${hint}`;
}

/** Looks up a semantic name or a primitive path. Throws for an unknown name or theme. */
export function resolveToken(tokens: TokenFile, name: string, theme?: string): ResolvedToken {
  const themes = selectThemes(tokens, theme);

  if (semanticNames(tokens).includes(name)) {
    const values = themes.map((current) => {
      const token = semanticTokens(tokens, current).find((candidate) => candidate.name === name) as SemanticToken;
      return { theme: current, value: token.value, chain: [name, token.primitive, token.value] };
    });
    return { name, kind: 'semantic', cssVar: semanticCssVar(name), values };
  }

  const value = getPrimitive(tokens.primitive, name);
  if (value === undefined) {
    const primitivePaths = flattenPrimitives(tokens.primitive).map((token) => token.path);
    throw new Error(unknownTokenMessage(name, [...semanticNames(tokens), ...primitivePaths]));
  }

  const cssVar = primitiveCssVar(name);
  return {
    name,
    kind: 'primitive',
    cssVar,
    values: [{ value, chain: [name, value] }],
    ...(cssVar === null ? { usedBy: usedBy(tokens, name, themes) } : {}),
  };
}
