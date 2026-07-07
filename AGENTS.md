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
- Merge to `main` only after the user has confirmed the PR should be merged, except under the Claude Code Autonomous PR Workflow below, where merge is pre-approved.
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

## Claude Code Autonomous PR Workflow

When Claude Code is doing the implementation work in this repository, the feature lifecycle follows this exact sequence:

1. **Plan.** Discuss the change and produce the OpenSpec proposal/design/tasks under `openspec/changes/<name>/`. Mandatory before any implementation.
2. **Design sign-off.** Wait for the user to review the OpenSpec design and explicitly grant permission to implement. Do not start implementation before this.
3. **Implement.** Build the feature on the `codex/`-prefixed feature branch. Immediately after implementing, run the relevant deterministic checks (`npm run build`, `npm run lint`, `npm run test:unit`, `npm run openspec:validate` as applicable) and fix any failures before handing off — this is pre-approved and does not require a confirmation prompt.
4. **Manual functional testing pause.** Stop and hand the feature to the user to exercise against dev or production eBay. Do not proceed past this point on your own.
5. **User sign-off.** Wait for the user to explicitly confirm the feature works as intended.
6. **Security review — dual gate.** Once sign-off is received, run both:
   - Claude Code's built-in `security-review` skill against the diff, and
   - GitHub Copilot CLI, non-interactively:
     ```bash
     copilot -p "Review the current uncommitted git diff for security issues. Do not modify files. Return verdict, findings, and recommended fixes only." --silent --deny-tool='write' --deny-tool='shell(*)'
     ```
   The review passes only if neither raises a blocking finding. If either does, stop and get explicit user direction rather than committing. (ChatGPT is not part of this automated gate — no scriptable connector exists; if the user wants a ChatGPT opinion, that happens manually outside this pipeline.)
7. **Ship it.** Once the dual security review passes, commit, push, open the PR (`gh pr create`), and merge (`gh pr merge --squash --delete-branch`), then sync local `main` and delete the local feature branch — all without a further confirmation prompt.

This standing authorization covers only this exact lifecycle on feature branches following the OpenSpec-first workflow above. It does not extend to direct commits on `main` (other than the session-notes exception above), force-pushes, history rewrites, or skipping steps 2, 4, or 5 — those still require the user's explicit go-ahead each time.
