import { readFile } from 'node:fs/promises';

export type PrimitiveNode = { [key: string]: string | PrimitiveNode };

export interface ContrastPair {
  fg: string;
  bg: string;
  min: number;
}

export interface TokenFile {
  primitive: PrimitiveNode;
  semantic: Record<string, Record<string, string>>;
  contrastPairs: ContrastPair[];
}

const REFERENCE = /^\{([^{}]+)\}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns the dotted path inside a `{color.teal.700}` reference, or undefined if the string isn't one. */
export function referencePath(reference: string): string | undefined {
  return REFERENCE.exec(reference)?.[1];
}

/** Returns the raw value at a dotted primitive path, or undefined if the path is missing or names a group. */
export function getPrimitive(primitive: PrimitiveNode, path: string): string | undefined {
  let node: string | PrimitiveNode = primitive;
  for (const key of path.split('.')) {
    if (typeof node === 'string' || !Object.hasOwn(node, key)) return undefined;
    node = node[key] as string | PrimitiveNode;
  }
  return typeof node === 'string' ? node : undefined;
}

function checkPrimitive(node: Record<string, unknown>, prefix: string, problems: string[]): void {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) checkPrimitive(value, path, problems);
    else if (typeof value !== 'string') problems.push(`primitive "${path}" must be a string or a group of tokens.`);
  }
}

function checkSemantic(semantic: Record<string, unknown>, primitive: PrimitiveNode, problems: string[]): void {
  const themes = Object.entries(semantic);
  if (themes.length === 0) problems.push('"semantic" must define at least one theme.');

  const allNames = new Set<string>();
  for (const [theme, names] of themes) {
    if (!isObject(names)) {
      problems.push(`semantic theme "${theme}" must be an object of token names.`);
      continue;
    }
    for (const [name, reference] of Object.entries(names)) {
      allNames.add(name);
      const path = typeof reference === 'string' ? referencePath(reference) : undefined;
      if (path === undefined) {
        problems.push(`semantic "${theme}.${name}" must be a reference like "{color.teal.700}".`);
      } else if (getPrimitive(primitive, path) === undefined) {
        problems.push(`semantic "${theme}.${name}" references "${path}", which is not a primitive token.`);
      }
    }
  }

  for (const [theme, names] of themes) {
    if (!isObject(names)) continue;
    for (const name of allNames) {
      if (!Object.hasOwn(names, name)) {
        problems.push(`theme "${theme}" is missing "${name}", which another theme defines.`);
      }
    }
  }
}

function checkContrastPairs(pairs: unknown[], semantic: Record<string, unknown>, problems: string[]): void {
  const known = new Set(Object.values(semantic).flatMap((names) => (isObject(names) ? Object.keys(names) : [])));
  pairs.forEach((pair, index) => {
    if (!isObject(pair) || typeof pair.fg !== 'string' || typeof pair.bg !== 'string' || typeof pair.min !== 'number') {
      problems.push(`contrastPairs[${index}] must have string "fg" and "bg" and a number "min".`);
      return;
    }
    for (const name of [pair.fg, pair.bg]) {
      if (!known.has(name)) problems.push(`contrastPairs[${index}] uses "${name}", which is not a semantic token.`);
    }
  });
}

/** Checks parsed JSON against the token format and reports every problem at once. Unknown top-level keys are ignored. */
export function validateTokens(data: unknown): TokenFile {
  if (!isObject(data)) throw new Error('The top level must be an object.');

  const problems: string[] = [];
  const { primitive, semantic, contrastPairs } = data;
  if (!isObject(primitive)) problems.push('Missing section "primitive" (an object).');
  if (!isObject(semantic)) problems.push('Missing section "semantic" (an object of themes).');
  if (!Array.isArray(contrastPairs)) problems.push('Missing section "contrastPairs" (an array).');

  if (isObject(primitive)) checkPrimitive(primitive, '', problems);
  if (isObject(primitive) && isObject(semantic)) checkSemantic(semantic, primitive as PrimitiveNode, problems);
  if (isObject(semantic) && Array.isArray(contrastPairs)) checkContrastPairs(contrastPairs, semantic, problems);

  if (problems.length > 0) throw new Error(problems.join(' '));
  return { primitive, semantic, contrastPairs } as TokenFile;
}

/** Reads and validates the token file. Errors name the file and the problem, so an agent can act on them. */
export async function loadTokens(path: string): Promise<TokenFile> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read token file "${path}": ${(error as Error).message}`, { cause: error });
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`Token file "${path}" is not valid JSON: ${(error as Error).message}`, { cause: error });
  }

  try {
    return validateTokens(data);
  } catch (error) {
    throw new Error(`Token file "${path}" is invalid: ${(error as Error).message}`, { cause: error });
  }
}
