# design-tokens-mcp

Coding agents tend to hardcode values like `#195e51` and `16px`, even in projects that have a design system, because nothing in front of them says which tokens exist. This is an MCP server that gives an agent a project's design tokens. It reads a token file, answers questions about it, and checks color contrast. It never writes to the file.

## Status

- [x] Milestone A: `list_tokens`, `resolve_token`, `check_contrast`
- [ ] Milestone B: `find_token` (nearest token for a hardcoded value), token file as an MCP resource
- [ ] Milestone C: evals that measure whether the server changes what an agent produces

Milestone A was checked by hand over stdio with a current client, a 2025-era client and Claude Code. There are no evals yet, so there is no evidence so far that the server changes agent output.

## Quick start

Requires Node 22.23 or newer.

```bash
git clone https://github.com/tablesleveldesign/design-tokens-mcp.git
cd design-tokens-mcp
npm ci
npm run build
```

Add it to Claude Code, using absolute paths so it works from any project:

```bash
claude mcp add design-tokens -- node /path/to/design-tokens-mcp/dist/index.js /path/to/tokens.json
```

The token path is the first argument. If there is no argument, the server uses the `DESIGN_TOKENS_PATH` environment variable. To try it without a token file of your own, use `fixtures/tokens.json`.

An example exchange with that fixture:

> **You:** Is `text-muted` on `surface-raised` readable?
>
> **Agent** calls `check_contrast` with `{"fg":"text-muted","bg":"surface-raised"}`, then answers: it is AA in both themes, 6.97 in light and 6.00 in dark, and passes the declared minimum of 4.5.

## Tools

Each tool returns readable text and structured data. Failures come back as tool errors with `isError: true`, and the message says what to do next. The examples below show the structured data.

### `list_tokens`

Lists tokens before an agent writes CSS. `category` is optional: `color`, `space`, `radius`, `font` or `semantic`. `theme` only affects semantic tokens. When it's omitted, the server uses `light`, else the file's only theme, else it returns an error listing the themes.

```json
{ "category": "radius" }
```

```json
{
  "tokens": [
    { "name": "radius.sm", "category": "radius", "value": "4px" },
    { "name": "radius.md", "category": "radius", "value": "8px" },
    { "name": "radius.lg", "category": "radius", "value": "12px" }
  ]
}
```

Semantic entries also have `primitive`, the path they point to.

### `resolve_token`

Looks up one semantic name or primitive path. Omitting `theme` returns every theme.

```json
{ "name": "accent-default" }
```

```json
{
  "name": "accent-default",
  "kind": "semantic",
  "cssVar": "--accent-default",
  "values": [
    { "theme": "light", "value": "#195e51", "chain": ["accent-default", "color.teal.700", "#195e51"] },
    { "theme": "dark", "value": "#4fb39d", "chain": ["accent-default", "color.teal.400", "#4fb39d"] }
  ]
}
```

`cssVar` is null for primitive colors, and `usedBy` lists the semantic tokens to use instead:

```json
{
  "name": "color.teal.700",
  "kind": "primitive",
  "cssVar": null,
  "values": [{ "value": "#195e51", "chain": ["color.teal.700", "#195e51"] }],
  "usedBy": { "light": ["accent-default", "accent-text"] }
}
```

That example asked for `"theme": "light"`. Without a theme, `usedBy` has an entry for every theme.

An unknown name returns the closest names:

```
Unknown token "accent-defalt". Closest names: accent-default, accent-text, accent-subtle.
```

### `check_contrast`

Checks a text color on a background. `fg` and `bg` are each a semantic name or `#rrggbb`. Omitting `theme` checks every theme. Grades are `AAA` (7 or more), `AA` (4.5 or more), `AA large` (3 or more) and `fail`. `min` and `pass` appear only when `contrastPairs` declares the pair. Two hex colors give one result with no `theme`.

```json
{ "fg": "text-muted", "bg": "surface-raised" }
```

```json
{
  "fg": "text-muted",
  "bg": "surface-raised",
  "results": [
    {
      "theme": "light",
      "fgValue": "#5e594d",
      "bgValue": "#ffffff",
      "ratio": 6.97,
      "grade": "AA",
      "min": 4.5,
      "pass": true
    },
    { "theme": "dark", "fgValue": "#9f998b", "bgValue": "#1e1c18", "ratio": 6, "grade": "AA", "min": 4.5, "pass": true }
  ]
}
```

## Token format

The reference file is [`tokens/tokens.json`](https://github.com/tablesleveldesign/portfolio/blob/main/tokens/tokens.json) in my portfolio repo, and `fixtures/tokens.json` is a copy of it. Any file in this format works:

```json
{
  "primitive": {
    "color": { "neutral": { "50": "#f7f6f3", "900": "#1e1c18" } },
    "space": { "4": "1rem" }
  },
  "semantic": {
    "light": { "text-primary": "{color.neutral.900}", "surface-base": "{color.neutral.50}" },
    "dark": { "text-primary": "{color.neutral.50}", "surface-base": "{color.neutral.900}" }
  },
  "contrastPairs": [{ "fg": "text-primary", "bg": "surface-base", "min": 4.5 }]
}
```

- `primitive` holds nested raw values, addressed by dotted paths like `color.neutral.50`.
- `semantic` maps names to `{primitive.path}` references, per theme. Every theme must define the same names.
- `contrastPairs` lists text and background pairs with a WCAG minimum ratio.
- Unknown top-level keys, like `$description`, are ignored.

**CSS variable names are an assumption.** The server doesn't read your CSS, so it assumes the naming the portfolio generates:

| Token                                  | Variable                         |
| -------------------------------------- | -------------------------------- |
| Semantic, like `accent-default`        | `--accent-default`               |
| Space, radius, font, like `space.4`    | `--space-4`, with dots as dashes |
| Primitive color, like `color.teal.700` | None, `cssVar` is null           |

If your build names variables differently, `cssVar` will be wrong for your project.

## Decisions

**Reload the file on every tool call.** Token files are small, and this way an edit shows up without restarting the agent session. The cost is a file read and validation on each call, and a half-saved file returns an error until it's fixed. I preferred that to serving stale values without saying so. The file is also checked at startup, so a wrong path fails right away.

**Read-only.** The server only answers questions. Changing tokens is a design decision that should go through the normal review of the token file, and this also means an agent can call any tool without risk.

**Descriptions are written for models.** Each tool description says when to call it, what it returns and gives one example, because that text is how an agent decides what to do. Errors follow the same idea: an unknown name returns the closest names, and an invalid file names the section, reference or theme at fault, all in one message.

**Primitive colors have no CSS variable.** The portfolio generates no `--color-*` variables, and components only use semantic tokens. Returning `--color-teal-700` would give an agent a variable that doesn't exist, so the tool returns null and points to the semantic tokens that use that color.

**Grades use the exact ratio.** The displayed ratio is rounded to two decimals, but 4.496 shows as 4.50 and still misses AA.

**SDK v2.** The server uses `@modelcontextprotocol/server` because v1 is now the maintenance line and doesn't support the 2026-07-28 spec. `serveStdio` also serves 2025-era clients, and both were checked by hand. Automated tool tests only run the current protocol, through the SDK client and an in-memory `fetch`, because the docs say `InMemoryTransport` only connects 2025-era instances.

**Plain code for validating the token file.** The checks that matter are cross-references, and their messages read better written by hand. Tool inputs and outputs use zod, which the SDK expects.

**Dependencies.** The only runtime dependencies are the SDK and zod.

## Evals

Not done yet. Results will go in `evals/RESULTS.md` when Milestone C lands.

## Roadmap

- `find_token`: given a hardcoded value like `#1a5f52` or `16px`, return the nearest tokens. Color distance will use OKLab, which is closer to how people perceive difference than RGB. Sizes will be normalized to rem at a 16px base.
- Expose the token file as an MCP resource, such as `tokens://current`.
- Evals: run small tasks through a headless agent with and without the server, score the output automatically, and publish the results with the method and its limits.
