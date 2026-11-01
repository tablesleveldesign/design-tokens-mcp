import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { findTokenPath } from './config.js';
import { createServer } from './server.js';
import { loadTokens } from './tokens/load.js';

try {
  const tokenPath = findTokenPath(process.argv.slice(2), process.env);
  await loadTokens(tokenPath);
  void serveStdio(() => createServer(tokenPath));
} catch (error) {
  // stdout carries the protocol, so messages for people go to stderr.
  console.error((error as Error).message);
  process.exit(1);
}
