# Handoff: design-tokens-mcp

A plan to give Claude Code in a fresh, empty repo. It is self-contained: Claude Code has not seen the career project, so everything it needs is here.

**How to start the session:** create an empty repo named `design-tokens-mcp`, save this file as `HANDOFF.md` and `claude/handoffs/COMMITS.md` (from the career project) as `docs/COMMITS.md`, open Claude Code in it, and paste:

> Read HANDOFF.md (this file, saved in the repo root) and docs/COMMITS.md. Start with Milestone A only. Before writing code, create CLAUDE.md from the starter in section 9, then propose a file layout and wait for my OK. Follow docs/COMMITS.md for every commit and PR. Check the installed `@modelcontextprotocol/sdk` README for the current API instead of assuming one.

Delete `HANDOFF.md` from the repo once the README covers its content, or keep it as `docs/plan.md`. It's fine for reviewers to see it.

---

## 1. What this is

An MCP server that gives coding agents access to a project's design tokens, so they use the design system instead of hardcoding colors and sizes. It reads a token file, answers questions about it, and checks color contrast.

It pairs with Todd's public portfolio repo (`portfolio`), whose `tokens/tokens.json` is the reference token file. The server must work with any file in the same format, not just that one.

**Audience for the repo:** engineers who review it for a job application (PostHog Product Engineer asks for "building for agents": MCP servers, evals, machine-oriented docs). The README and tool descriptions are part of the product.

## 2. Ground rules

- **Write everything from scratch.** Use only generic, public knowledge of MCP, TypeScript, and color math. Nothing from any employer's code, instructions, or skills.
- **Read-only.** The server never writes to the token file.
- **Commits and PRs follow `docs/COMMITS.md`:** Conventional Commits (`feat`, `fix`, `chore`), one idea per commit, body says why, Todd approves each commit, one PR per milestone, no squash merges. Keep the Co-Authored-By trailer.
- **README voice:** plain and specific. No em dashes, no marketing words ("leverage," "seamless," "robust," "powerful"). Explain decisions and trade-offs.

## 3. Stack

- Node 26 (current LTS; set `.nvmrc` to 26 and `engines` to `>=22.23` unless a dependency needs newer), TypeScript (strict), ESM
- `@modelcontextprotocol/sdk` (1.32.x when this was written), stdio transport, the high-level server API
- Schema validation with whatever the SDK expects for tool inputs (zod at the time of writing; confirm against the installed version)
- vitest for tests, ESLint + Prettier, GitHub Actions CI (format check, lint, typecheck, test, build)
- No runtime dependencies beyond the SDK and its schema library unless there's a clear reason, recorded in the README

## 4. Token file format

Same format as the portfolio's `tokens/tokens.json`. Include a copy as `fixtures/tokens.json` for tests and examples.

```json
{
  "primitive": {
    "color": { "neutral": { "50": "#f7f6f3", "900": "#1e1c18" }, "teal": { "700": "#195e51" } },
    "space": { "1": "0.25rem", "4": "1rem" },
    "radius": { "md": "8px" },
    "font": { "size": { "0": "1rem" }, "weight": { "bold": "700" } }
  },
  "semantic": {
    "light": { "text-primary": "{color.neutral.900}", "accent-default": "{color.teal.700}" },
    "dark": { "text-primary": "{color.neutral.50}" }
  },
  "contrastPairs": [{ "fg": "text-primary", "bg": "surface-base", "min": 4.5 }]
}
```

- `primitive`: nested raw values. Paths are dotted: `color.neutral.50`.
- `semantic`: per theme, names mapped to `{primitive.path}` references. Every theme defines the same names.
- `contrastPairs`: text/background pairs with a WCAG minimum ratio.
- Unknown top-level keys (like `$description`) are ignored.

Validate on load and fail with a message that names the problem: missing section, a reference to a primitive that doesn't exist, a theme missing a name another theme has.

## 5. Configuration

- Token file path from the first CLI argument, else the `DESIGN_TOKENS_PATH` env var. Exit with a clear message if neither is set or the file is invalid.
- Reload the file on each tool call (it's small). That way edits show up without restarting the agent session. Note the trade-off in the README.

## 6. Tools

Tool descriptions are written for a model, not a person. Each should say: when to call it, what it returns, and one short example. Keep the outputs structured and compact. Return both readable text and structured data if the SDK supports it.

### Milestone A (target: Monday)

**`list_tokens`**
- Input: `category` (optional: `color`, `space`, `radius`, `font`, `semantic`), `theme` (optional, default `light`)
- Returns: token names with resolved values. For `semantic`, also returns the primitive each one points to.
- Use: "What tokens exist before I write CSS?"

**`resolve_token`**
- Input: `name` (semantic name like `accent-default`, or a primitive path like `color.teal.700`), `theme` (optional; when omitted, return every theme)
- Returns: the raw value, the reference chain, and the CSS custom property name (`--accent-default`)
- Errors: unknown name returns the closest few names, so the agent can correct itself.

**`check_contrast`**
- Input: `fg`, `bg` (each a semantic name or `#rrggbb`), `theme` (optional; when omitted, check every theme)
- Returns: ratio to two decimals, WCAG grade (`AAA` ≥ 7, `AA` ≥ 4.5, `AA large` ≥ 3, `fail`), and pass/fail against `min` if the pair is declared in `contrastPairs`
- Implement WCAG 2.x relative luminance. Test against known values: black on white is 21, `#777777` on white is about 4.48.

### Milestone B (week after applying)

**`find_token`**
- Input: `value` (a hex color, or a size like `16px` / `1rem`), `theme` (optional), `limit` (default 3)
- Returns: the nearest semantic tokens first (then primitives), each with its distance, and whether it's an exact match
- Color distance in OKLab (Euclidean), not RGB, because it's closer to how people perceive difference. Sizes are normalized to rem at a 16px base. Explain both choices in the README.
- Use: "This component hardcodes `#1a5f52`. Which token should it be?"

**Resource:** expose the token file as an MCP resource (for example `tokens://current`), so a client can read the whole file directly.

### Milestone C: evals

See section 8.

## 7. Tests

- Unit tests for the token logic: reference resolution, validation errors, contrast math, OKLab distance, size normalization.
- Tool tests that call the handlers through the SDK's in-memory or test transport if it has one; otherwise test the handler functions directly. Cover a success case and an error case per tool.
- CI must pass on every PR.

## 8. Evals (Milestone C)

The goal is to show, with numbers, whether the server changes what an agent produces. Rough is fine. Being honest about the method matters more than a big sample.

- `evals/tasks/`: 5–8 small tasks, each a fixture plus a prompt. Examples:
  1. A React component with three hardcoded hex colors: replace them with tokens.
  2. "Pick a text color that passes AA on `accent-subtle` in both themes."
  3. A CSS file with `margin: 16px; padding: 12px`: use spacing tokens.
  4. "Add a warning banner style using existing tokens only."
- `evals/run`: runs each task twice through a headless agent (for example `claude -p` with and without this server configured), saving outputs.
- `evals/score`: checks each output automatically. Does it still contain raw hex or px values? Do all referenced tokens exist? Do the pairs used pass contrast?
- `evals/RESULTS.md`: a table by task and condition, plus what was surprising and the limits of the method (small sample, one model, cost per run).

## 9. Starter CLAUDE.md

```markdown
# design-tokens-mcp

MCP server that lets coding agents query a design token file and check contrast. Read-only.

## Commands
- npm run build / npm test / npm run lint / npm run typecheck
- Local try: claude mcp add design-tokens -- node dist/index.js fixtures/tokens.json

## Rules
- Write from scratch; no code or text from any employer.
- Never write to the token file.
- Tool descriptions are for models: when to call, what it returns, one example.
- Commits and PRs follow docs/COMMITS.md. Read it before the first commit in a session.
- README: no em dashes, no marketing words. Explain decisions.
- Check the installed @modelcontextprotocol/sdk README before using its API.

## Layout
(fill in after the layout is agreed)
```

## 10. README outline

1. One paragraph: what it is and the problem (agents hardcode values instead of using the design system)
2. Status: milestone checklist, honest about what works today
3. Quick start: install, `claude mcp add` command, one example exchange
4. Tools: one short section each, with example input and output
5. Token format, linking the portfolio repo as the reference file
6. Decisions: reload on every call, read-only, OKLab distance, descriptions written for models
7. Evals: link to `evals/RESULTS.md` once Milestone C lands
8. Roadmap

## 11. Acceptance checks

**Milestone A (Monday)**
- [ ] `npm ci && npm test && npm run build` pass from a clean clone; CI is green
- [ ] Added to Claude Code with `claude mcp add`, an agent can list tokens, resolve `accent-default` in both themes, and check `text-muted` on `surface-raised`
- [ ] An invalid token file and an unknown token name both produce messages an agent can act on
- [ ] README has status, quick start, the three tools, and the roadmap

**Milestone B**
- [ ] `find_token` returns `accent-default` as the top match for `#1a5f52` with the fixture file
- [ ] Resource readable from a client

**Milestone C**
- [ ] Eval run reproducible from one command; RESULTS.md committed with method and limits

## 12. Decisions made during the build (Nov 1, 2026)

Answers to questions Claude Code raised in Milestone A. These override earlier sections where they differ.

- **CSS variable names in `resolve_token`.** Semantic tokens return `--<name>`. Non-color primitives return the name the portfolio generates (`--space-4`, `--radius-md`, `--font-size-0`). Primitive colors return `cssVar: null` plus `usedBy`: the semantic tokens that point to them, per theme. Components only use semantic tokens, and no `--color-*` variables exist. The tool description says `cssVar` can be null and what to use instead. The README documents the naming convention as an assumption of the token format.
- **Default theme.** `resolve_token` and `check_contrast` already default to every theme when `theme` is omitted. Only `list_tokens` needs a default: use `light` if present; if the file has exactly one theme, use that; otherwise return an error listing the available themes.
- **TypeScript:** pin 6.0.x, because `typescript-eslint` requires below 6.1. Revisit when it supports 7. This matches the portfolio.
- **CLAUDE.md commands** include `npm run format:check` and `npm run format`.
- **Commit trailer:** exactly `Co-Authored-By: Claude <noreply@anthropic.com>`, as in `docs/COMMITS.md`.
- **SDK:** use v2 (`@modelcontextprotocol/server` 2.4 and `serveStdio`), not `@modelcontextprotocol/sdk` as sections 3 and 9 and the opening prompt say. v1 is now the maintenance line and doesn't support the 2026-07-28 spec. `@modelcontextprotocol/client` is a dev dependency for tests. Tool tests connect through `createMcpHandler` with an in-memory `fetch`, because the docs say `InMemoryTransport` only connects 2025-era instances.
