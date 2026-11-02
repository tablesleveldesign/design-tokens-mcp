import { resolve } from 'node:path';

/** The token file path: the first CLI argument, else DESIGN_TOKENS_PATH. Made absolute so later reloads can't drift. */
export function findTokenPath(args: string[], env: NodeJS.ProcessEnv): string {
  const path = args[0] || env.DESIGN_TOKENS_PATH;
  if (!path) {
    throw new Error(
      'No token file given. Pass its path as the first argument or set DESIGN_TOKENS_PATH. ' +
        'Example: node dist/index.js fixtures/tokens.json',
    );
  }
  return resolve(path);
}
