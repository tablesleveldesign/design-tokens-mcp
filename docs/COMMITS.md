# Commit and PR rules

<!-- Generic copy: save as docs/COMMITS.md in each public repo and point CLAUDE.md at it. -->

For anyone committing to this repo, including coding agents. The history is public and is read like a case study, so every commit should be clear to a reviewer who has never seen the code.

## Format

Conventional Commits, the same three types PostHog uses:

```
<type>(<scope>): <description>

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
```

- `feat`: new behavior a user or agent can see
- `fix`: fixes broken behavior
- `chore`: everything else (tests, docs, config, CI, refactors, agent instructions)

**Subject:** lowercase after the colon, imperative ("add", not "added"), no period, under 72 characters, specific. Scope is the area of the repo (for example `tools`, `tokens`, `evals`, `skills`, `hooks`, `ci`, `readme`).

**Body:** why first, then what changed at a high level, then trade-offs or rejected alternatives. Wrap at 72. Leave it out only when the subject says everything.

**Voice:** plain and specific. No em dashes. No marketing words ("comprehensive", "robust", "seamless", "leverage", "enhance", "powerful").

## Scope of a commit

- One idea per commit. Tests go in the same commit as the code they test.
- Formatting-only and rename-only changes get their own commit.
- Keep commits readable in a couple of minutes: roughly under 300 changed lines, excluding lockfiles and generated files.
- Every commit leaves the repo building with tests passing.
- Never commit `.env` files, build output, generated files, or any employer's code or content.

## Process (agents: follow this exactly)

1. Work on a branch (`feat/...`, `fix/...`, `chore/...`), never directly on `main`.
2. Before committing, run the repo's format, lint, typecheck, and test commands (listed in CLAUDE.md).
3. Show Todd the files, a short summary of the diff, and the proposed message. Commit only after he approves or edits it.
4. Keep the `Co-Authored-By` trailer. Don't put "Generated with" lines in commit messages.
5. Fold follow-up fixes into the commit they belong to before pushing (`git commit --fixup <sha>`, then `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash main`). Never rewrite history on `main`.
6. Open the PR as a **draft** as soon as the branch has its first commit, and fill in the description as the work goes.
7. Only Todd merges. Never merge a PR, mark it ready, or push to `main`.

## Pull requests

The PR description is copied into the merge commit on `main` at the moment of merging. Editing the PR afterward doesn't change the commit, and `main` is never rewritten. So the description is permanent history and must be finished before merging.

**Title:** same format as a commit subject: `feat(tokens): replace placeholder palette with figma variables`.

**Description:** use the template in `.github/pull_request_template.md` (create it from the block below if the repo doesn't have one).

```markdown
## Changes
- One line per meaningful change

## Decisions
- Choices made and why; alternatives considered

## Testing
- [ ] Tests added or updated
- [ ] Checked by hand (what, and where)
```

**Rules for the description**
- Replace every placeholder line with real content. No template text may remain when the PR is marked ready.
- Delete any section that would only say "n/a". A one-commit PR can be three short lines.
- Decisions say why, including alternatives you rejected. If there were no real decisions, say what the change doesn't affect (for example "No behavior change").
- Testing lists what was actually run or checked. Tick a box only if it was done.
- Screenshots go in a **PR comment**, not the description. Images in the description become long URL lines in the merge commit.
- Same voice as commits: plain, specific, no em dashes, no marketing words.

**Before telling Todd a PR is ready to merge**
1. CI is green.
2. The title is a valid conventional commit subject.
3. The description has no placeholder text and matches the commits on the branch.
4. Screenshots for visual changes are posted as a comment.
5. Remind Todd to read the merge dialog and choose **Create a merge commit** (never squash).

**Short example (one-commit PR)**

```markdown
## Changes
- Add `permissions: contents: read` to the CI workflow

## Decisions
- The workflow only reads code, so its token shouldn't be able to write. No behavior change.

## Testing
- [x] CI passes on this PR
```

## Examples

Good:

```
feat(tools): return the closest token names when a lookup fails

Agents often guess token names. An unknown-name error now lists the
three nearest matches, so the agent can correct itself in the next
call instead of asking the user.
```

```
chore(readme): explain why the server reloads the token file per call
```

Bad: `update files`, `wip`, `fix stuff`, `address feedback`, `Added explorer and fixed header` (past tense, two changes), or one 2,000-line commit.
