import { McpServer } from '@modelcontextprotocol/server';
import { registerListTokens } from './tools/list-tokens.js';

/** Builds the server. Tools reload `tokenPath` on every call, so edits show up without a restart. */
export function createServer(tokenPath: string): McpServer {
  const server = new McpServer({ name: 'design-tokens-mcp', version: '0.1.0' });
  registerListTokens(server, tokenPath);
  return server;
}
