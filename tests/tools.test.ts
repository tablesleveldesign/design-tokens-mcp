import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

const FIXTURE = 'fixtures/tokens.json';

// The docs say InMemoryTransport only connects 2025-era instances, so tests use an in-memory fetch to reach the handler.
// That runs the same negotiation as a current client.
const cleanups: (() => Promise<void>)[] = [];

async function connect(tokenPath = FIXTURE): Promise<Client> {
  const handler = createMcpHandler(() => createServer(tokenPath));
  const client = new Client({ name: 'test', version: '0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(new URL('http://test/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  await client.connect(transport);
  cleanups.push(async () => {
    await client.close();
    await handler.close();
  });
  return client;
}

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structuredContent: any;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as unknown as ToolResult;
}

const errorText = (result: ToolResult) => {
  expect(result.isError).toBe(true);
  return result.content[0]?.text;
};

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'design-tokens-tools-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true });
});
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe('tool descriptions', () => {
  it('say when to call the tool and give an example', async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.description).toMatch(/Example:/);
      expect(tool.outputSchema).toBeDefined();
    }
  });
});

describe('list_tokens', () => {
  it('lists semantic tokens with their primitive, defaulting to light', async () => {
    const result = await call(await connect(), 'list_tokens', { category: 'semantic' });
    expect(result.structuredContent.theme).toBe('light');
    expect(result.structuredContent.tokens).toContainEqual({
      name: 'accent-default',
      category: 'semantic',
      value: '#195e51',
      primitive: 'color.teal.700',
    });
    expect(result.content[0]?.text).toContain('accent-default: #195e51 (color.teal.700)');
  });

  it('uses the requested theme', async () => {
    const { structuredContent } = await call(await connect(), 'list_tokens', { category: 'semantic', theme: 'dark' });
    expect(structuredContent.theme).toBe('dark');
    expect(structuredContent.tokens).toContainEqual(
      expect.objectContaining({ name: 'accent-default', value: '#4fb39d' }),
    );
  });

  it('limits primitives to the category and omits the theme', async () => {
    const { structuredContent } = await call(await connect(), 'list_tokens', { category: 'radius' });
    expect(structuredContent).toEqual({
      tokens: [
        { name: 'radius.sm', category: 'radius', value: '4px' },
        { name: 'radius.md', category: 'radius', value: '8px' },
        { name: 'radius.lg', category: 'radius', value: '12px' },
      ],
    });
  });

  it('lists everything when no category is given', async () => {
    const { structuredContent } = await call(await connect(), 'list_tokens');
    const categories = new Set(structuredContent.tokens.map((token: { category: string }) => token.category));
    expect([...categories].sort()).toEqual(['color', 'font', 'radius', 'semantic', 'space']);
  });

  it('lists the themes for an unknown theme', async () => {
    const result = await call(await connect(), 'list_tokens', { theme: 'sepia' });
    expect(errorText(result)).toContain('Unknown theme "sepia". Available themes: light, dark.');
  });

  it('rejects an unknown category before running', async () => {
    const result = await call(await connect(), 'list_tokens', { category: 'shadow' });
    expect(errorText(result)).toContain('Input validation error');
  });

  it('picks up edits to the file between calls', async () => {
    const path = join(dir, 'edited.json');
    const file = (value: string) =>
      JSON.stringify({ primitive: { radius: { md: value } }, semantic: { light: {} }, contrastPairs: [] });
    await writeFile(path, file('8px'));
    const client = await connect(path);
    expect((await call(client, 'list_tokens', { category: 'radius' })).structuredContent.tokens[0].value).toBe('8px');
    await writeFile(path, file('6px'));
    expect((await call(client, 'list_tokens', { category: 'radius' })).structuredContent.tokens[0].value).toBe('6px');
  });

  it('reports a token file that became invalid', async () => {
    const path = join(dir, 'invalid.json');
    await writeFile(path, '{}');
    const result = await call(await connect(path), 'list_tokens');
    expect(errorText(result)).toMatch(/invalid\.json" is invalid: Missing section "primitive"/);
  });
});

describe('resolve_token', () => {
  it('returns every theme with the value, chain and CSS variable', async () => {
    const { structuredContent, content } = await call(await connect(), 'resolve_token', { name: 'accent-default' });
    expect(structuredContent).toEqual({
      name: 'accent-default',
      kind: 'semantic',
      cssVar: '--accent-default',
      values: [
        { theme: 'light', value: '#195e51', chain: ['accent-default', 'color.teal.700', '#195e51'] },
        { theme: 'dark', value: '#4fb39d', chain: ['accent-default', 'color.teal.400', '#4fb39d'] },
      ],
    });
    expect(content[0]?.text).toContain('light: accent-default -> color.teal.700 -> #195e51');
  });

  it('returns null cssVar and usedBy for a primitive color', async () => {
    const { structuredContent, content } = await call(await connect(), 'resolve_token', { name: 'color.teal.700' });
    expect(structuredContent.cssVar).toBeNull();
    expect(structuredContent.usedBy.light).toEqual(['accent-default', 'accent-text']);
    expect(content[0]?.text).toContain('none, use a semantic token');
  });

  it('returns the closest names for an unknown token', async () => {
    const result = await call(await connect(), 'resolve_token', { name: 'accent-defalt' });
    expect(errorText(result)).toMatch(/^Unknown token "accent-defalt"\. Closest names: accent-default/);
  });
});
