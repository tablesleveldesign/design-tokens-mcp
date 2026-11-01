import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { loadTokens } from '../tokens/load.js';
import { defaultTheme, flattenPrimitives, selectThemes, semanticTokens } from '../tokens/resolve.js';

const DESCRIPTION = `List the design tokens in the project. Call this before writing or changing CSS or styles, so you use existing tokens instead of hardcoding colors and sizes.

Returns each token's name, category and resolved value. Semantic tokens also return the primitive they point to. Use semantic tokens in components: the CSS variable is --<name>. Call resolve_token for details on one token.

category limits the list to color, space, radius, font or semantic; omit it to list everything. theme only affects semantic tokens and defaults to light.

Example: {"category":"semantic","theme":"dark"} returns entries like {"name":"accent-default","category":"semantic","value":"#4fb39d","primitive":"color.teal.400"}.`;

const inputSchema = z.object({
  category: z
    .enum(['color', 'space', 'radius', 'font', 'semantic'])
    .optional()
    .describe('Omit to list every category.'),
  theme: z.string().optional().describe('Theme for semantic tokens, like light or dark. Defaults to light.'),
});

const outputSchema = z.object({
  theme: z.string().optional().describe('The theme used for semantic tokens. Absent if none were listed.'),
  tokens: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      value: z.string(),
      primitive: z.string().optional().describe('Semantic tokens only: the primitive path this token points to.'),
    }),
  ),
});

export function registerListTokens(server: McpServer, tokenPath: string): void {
  server.registerTool(
    'list_tokens',
    {
      title: 'List design tokens',
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ category, theme }) => {
      const tokens = await loadTokens(tokenPath);
      if (theme !== undefined) selectThemes(tokens, theme);

      const primitives = flattenPrimitives(tokens.primitive)
        .map(({ path, value }) => ({ name: path, category: path.split('.')[0] as string, value }))
        .filter((token) => category === undefined || token.category === category);

      const listSemantic = category === undefined || category === 'semantic';
      const usedTheme = listSemantic ? (theme ?? defaultTheme(tokens)) : undefined;
      const semantic =
        usedTheme === undefined
          ? []
          : semanticTokens(tokens, usedTheme).map(({ name, value, primitive }) => ({
              name,
              category: 'semantic',
              value,
              primitive,
            }));

      const listed = [...semantic, ...primitives];
      const lines = listed.map((token) =>
        'primitive' in token ? `${token.name}: ${token.value} (${token.primitive})` : `${token.name}: ${token.value}`,
      );
      const heading =
        usedTheme === undefined ? `${listed.length} tokens` : `${listed.length} tokens, theme ${usedTheme}`;

      return {
        content: [{ type: 'text', text: [heading, ...lines].join('\n') }],
        structuredContent: { ...(usedTheme === undefined ? {} : { theme: usedTheme }), tokens: listed },
      };
    },
  );
}
