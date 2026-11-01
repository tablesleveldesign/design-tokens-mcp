# design-tokens-mcp

MCP server that lets coding agents query a design token file and check contrast. Read-only.

## Commands

- npm run build / npm test / npm run lint / npm run typecheck / npm run format:check / npm run format
- Local try: claude mcp add design-tokens -- node dist/index.js fixtures/tokens.json

## Rules

- Write from scratch; no code or text from any employer.
- Never write to the token file.
- Tool descriptions are for models: when to call, what it returns, one example.
- Commits and PRs follow docs/COMMITS.md. Read it before the first commit in a session.
- README: no em dashes, no marketing words. Explain decisions.
- Check the installed @modelcontextprotocol/server README and the v2 docs (https://ts.sdk.modelcontextprotocol.io/v2/) before using its API.

## Layout

- src/index.ts: CLI entry, checks the token file at startup, then serves over stdio
- src/config.ts: finds the token path from the CLI argument or DESIGN_TOKENS_PATH
- src/server.ts: createServer(tokenPath), registers the tools
- src/tokens/load.ts: reads, parses and validates the file; called on every tool call
- src/tokens/resolve.ts: flattens primitives, follows references, CSS variable names
- src/tokens/suggest.ts: closest names for unknown-name errors
- src/contrast.ts: WCAG luminance, ratio, grade
- src/tools/: one file per tool, holding its description, schemas and handler
- tests/: unit tests per module, plus tools.test.ts through the SDK client
- fixtures/tokens.json: exact copy of the portfolio's tokens/tokens.json
