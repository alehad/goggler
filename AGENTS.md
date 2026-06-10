# Repository Guidance

This repository uses OpenSpec to drive planning and implementation.

Before implementing behavior, create or update an OpenSpec change under `openspec/changes/`. Accepted behavior should later be reflected under `openspec/specs/`.

Every implementation step must be preceded by an OpenSpec planning step. The planning and implementation may happen on the same feature branch, but the first step of the branch should create or update the relevant `proposal.md`, `design.md`, `tasks.md`, and spec deltas as needed. Implementation should proceed only after the user has had a chance to review the OpenSpec design for that step.

## Project Direction

goggler is a personal-first eBay UK auction tracker. It imports authenticated buying history, tracks items the user did not win, searches for likely exact relistings, and presents matches in an app dashboard.

## Security And Persistence Invariants

- eBay OAuth access tokens, refresh tokens, authorization codes, and other OAuth credential material must remain scoped to the active server-side session only.
- Never persist eBay OAuth credential material in any database or durable store, regardless of whether the store is local, hosted, encrypted, shared, temporary, development, test, staging, or production.
- Never add database columns, models, migrations, serialized payloads, logs, caches, backups, or import metadata capable of storing eBay OAuth credential values.
- Persistent eBay-related storage may contain only explicitly approved non-secret data, such as normalized won-item records and sanitized import-run metadata.
- Any change that introduces or modifies persistence must include deterministic checks proving that eBay OAuth credential material is not represented in the persistent schema and is not written during runtime behavior.
- If a proposed feature appears to require persisted eBay OAuth credential material, stop and redesign it around fresh user authentication or active-session credentials instead.

## Git Workflow

- Do development work on short-lived branches using the `codex/` prefix by default.
- Open pull requests from feature branches into `main`.
- Merge to `main` only after the user has confirmed the PR should be merged.
- Prefer GitHub CLI (`gh`) for PR creation and merge/cleanup when it is authenticated and available.
- When the user explicitly asks to create a PR, prefer `gh pr create` over raw GitHub API calls.
- When the user explicitly asks to merge an approved PR, prefer `gh pr merge --squash --delete-branch`, then synchronize local `main` and delete the local branch.
- If `gh` is unavailable or unauthenticated, Codex may use the GitHub API via `curl` to merge the PR, delete the remote branch, synchronize local `main`, and delete the local branch.
- The user has pre-approved this repository PR merge/cleanup workflow conceptually; still follow runtime approval prompts if the Codex environment requires them.
- After a PR is merged, delete the feature branch on GitHub and locally unless the user asks to keep it.
- Keep `main` clean and up to date before starting new work.
- Do not commit directly on `main`, except for explicit end-of-session updates to `docs/session-notes.md` requested by the user.
- All code, dependency, configuration, OpenSpec, and non-session-note documentation changes must follow the branch and pull request workflow.

## Review Workflow

- Before committing security-sensitive changes, prefer a local advisory security review of the uncommitted diff when a callable local tool is available, such as VS Code GitHub Copilot review or another explicit Copilot CLI integration.
- When GitHub Copilot CLI is authenticated and available, prefer a non-interactive, read-only review prompt before committing security-sensitive changes. Ask it to review the current uncommitted git diff for security issues, return only verdict/findings/recommended fixes, and not modify files.
- A suitable Copilot CLI pattern is:

```bash
copilot -p "Review the current uncommitted git diff for security issues. Do not modify files. Return verdict, findings, and recommended fixes only." --silent --deny-tool='write' --deny-tool='shell(*)'
```

- If no Copilot/VS Code review command is available in the Codex environment, say so and continue with normal verification plus any security review feedback the user provides manually.
- Treat advisory AI review as supplemental. Do not replace deterministic checks such as unit tests, production build, and direct code inspection.
