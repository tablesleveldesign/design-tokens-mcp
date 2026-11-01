import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { loadTokens } from '../tokens/load.js';
import { resolveToken } from '../tokens/resolve.js';

const DESCRIPTION = `Look up one design token. Call this when you know a token's name and need its value, its CSS variable, or what it points to.

name is a semantic name like accent-default or a primitive path like color.teal.700. Omit theme to get every theme.

Returns kind, cssVar, and values with each raw value and its reference chain. cssVar can be null: primitive colors have no CSS variable, so the result lists usedBy, the semantic tokens that point to that color per theme. Use one of those semantic tokens instead. An unknown name returns an error with the closest names, so you can retry.

Example: {"name":"accent-default","theme":"light"} returns {"name":"accent-default","kind":"semantic","cssVar":"--accent-default","values":[{"theme":"light","value":"#195e51","chain":["accent-default","color.teal.700","#195e51"]}]}.`;

const inputSchema = z.object({
  name: z.string().describe('A semantic name like accent-default, or a primitive path like color.teal.700.'),
  theme: z.string().optional().describe('Omit to return every theme.'),
});

const outputSchema = z.object({
  name: z.string(),
  kind: z.enum(['semantic', 'primitive']),
  cssVar: z.string().nullable().describe('Null for primitive colors. Use a token from usedBy instead.'),
  values: z.array(
    z.object({
      theme: z.string().optional().describe('Absent for primitives, which have the same value in every theme.'),
      value: z.string(),
      chain: z.array(z.string()).describe('Each step from the requested name to the raw value.'),
    }),
  ),
  usedBy: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe('Primitive colors only: semantic tokens that point to this color, per theme.'),
});

export function registerResolveToken(server: McpServer, tokenPath: string): void {
  server.registerTool(
    'resolve_token',
    {
      title: 'Resolve a design token',
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, theme }) => {
      const token = resolveToken(await loadTokens(tokenPath), name, theme);

      const lines = [
        `${token.name} (${token.kind}), CSS variable: ${token.cssVar ?? 'none, use a semantic token'}`,
        ...token.values.map(({ theme: valueTheme, chain }) =>
          valueTheme === undefined ? chain.join(' -> ') : `${valueTheme}: ${chain.join(' -> ')}`,
        ),
        ...Object.entries(token.usedBy ?? {}).map(
          ([usedTheme, names]) => `used by in ${usedTheme}: ${names.join(', ') || 'none'}`,
        ),
      ];

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { ...token },
      };
    },
  );
}
