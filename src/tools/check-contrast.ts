import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { contrastRatio, gradeContrast, isHexColor, roundRatio } from '../contrast.js';
import type { TokenFile } from '../tokens/load.js';
import { loadTokens } from '../tokens/load.js';
import { selectThemes, semanticNames, semanticTokens, unknownTokenMessage } from '../tokens/resolve.js';

const DESCRIPTION = `Check the WCAG contrast of a text color on a background. Call this when choosing or changing a text and background pair, before you commit to it.

fg and bg are each a semantic name like text-muted or a color like #1a5f52. Omit theme to check every theme; a pair can pass in light and fail in dark.

Returns the ratio to two decimals and a grade for each theme: AAA (7 or more), AA (4.5 or more), AA large (3 or more, large text only) or fail. If the token file declares this pair, it also returns the declared min and whether the pair passes. If both colors are hex, there is one result with no theme.

Example: {"fg":"text-muted","bg":"surface-raised","theme":"light"} returns {"fg":"text-muted","bg":"surface-raised","results":[{"theme":"light","fgValue":"#5e594d","bgValue":"#ffffff","ratio":6.97,"grade":"AA","min":4.5,"pass":true}]}.`;

const inputSchema = z.object({
  fg: z.string().describe('Text color: a semantic name like text-muted, or #rrggbb.'),
  bg: z.string().describe('Background color: a semantic name like surface-raised, or #rrggbb.'),
  theme: z.string().optional().describe('Omit to check every theme.'),
});

const outputSchema = z.object({
  fg: z.string(),
  bg: z.string(),
  results: z.array(
    z.object({
      theme: z.string().optional().describe('Absent when both colors are hex.'),
      fgValue: z.string(),
      bgValue: z.string(),
      ratio: z.number(),
      grade: z.enum(['AAA', 'AA', 'AA large', 'fail']),
      min: z.number().optional().describe('Only when contrastPairs declares this pair.'),
      pass: z.boolean().optional().describe('Only when contrastPairs declares this pair.'),
    }),
  ),
});

/** Turns an input into a `#rrggbb` value. Errors say what to send instead. */
function colorValue(tokens: TokenFile, input: string, theme: string | undefined): string {
  if (input.startsWith('#')) {
    if (isHexColor(input)) return input.toLowerCase();
    throw new Error(`"${input}" is not a #rrggbb color. Write all six digits.`);
  }

  const token = theme === undefined ? undefined : semanticTokens(tokens, theme).find(({ name }) => name === input);
  if (token === undefined) {
    throw new Error(`${unknownTokenMessage(input, semanticNames(tokens))} fg and bg take a semantic name or #rrggbb.`);
  }
  if (!isHexColor(token.value)) {
    throw new Error(`"${input}" is "${token.value}" in theme "${theme}", which is not a #rrggbb color.`);
  }
  return token.value.toLowerCase();
}

export function registerCheckContrast(server: McpServer, tokenPath: string): void {
  server.registerTool(
    'check_contrast',
    {
      title: 'Check color contrast',
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ fg, bg, theme }) => {
      const tokens = await loadTokens(tokenPath);
      const themes = selectThemes(tokens, theme);
      const bothHex = fg.startsWith('#') && bg.startsWith('#');
      const declared = tokens.contrastPairs.find((pair) => pair.fg === fg && pair.bg === bg);

      const results = (bothHex ? [undefined] : themes).map((current) => {
        const fgValue = colorValue(tokens, fg, current);
        const bgValue = colorValue(tokens, bg, current);
        const ratio = contrastRatio(fgValue, bgValue);
        return {
          ...(current === undefined ? {} : { theme: current }),
          fgValue,
          bgValue,
          ratio: roundRatio(ratio),
          grade: gradeContrast(ratio),
          ...(declared === undefined ? {} : { min: declared.min, pass: ratio >= declared.min }),
        };
      });

      const lines = results.map((result) => {
        const prefix = result.theme === undefined ? '' : `${result.theme}: `;
        const required =
          result.min === undefined ? '' : `, declared min ${result.min}: ${result.pass ? 'pass' : 'fail'}`;
        return `${prefix}${fg} on ${bg}: ${result.ratio.toFixed(2)} (${result.grade})${required}`;
      });

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { fg, bg, results },
      };
    },
  );
}
