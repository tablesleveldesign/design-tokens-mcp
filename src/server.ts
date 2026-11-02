import { McpServer } from '@modelcontextprotocol/server';
import { registerCheckContrast } from './tools/check-contrast.js';
import { registerListTokens } from './tools/list-tokens.js';
import { registerResolveToken } from './tools/resolve-token.js';

/** Builds the server. Tools reload `tokenPath` on every call, so edits show up without a restart. */
export function createServer(tokenPath: string): McpServer {
  const server = new McpServer({ name: 'design-tokens-mcp', version: '0.1.0' });
  registerListTokens(server, tokenPath);
  registerResolveToken(server, tokenPath);
  registerCheckContrast(server, tokenPath);
  return server;
}
