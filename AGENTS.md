# Repository Guidance

This repository uses OpenSpec to drive planning and implementation.

Before implementing behavior, create or update an OpenSpec change under `openspec/changes/`. Accepted behavior should later be reflected under `openspec/specs/`.

## Project Direction

goggler is a personal-first eBay UK auction tracker. It imports authenticated buying history, tracks items the user did not win, searches for likely exact relistings, and presents matches in an app dashboard.

## Git Workflow

- Do development work on short-lived branches using the `codex/` prefix by default.
- Open pull requests from feature branches into `main`.
- Merge to `main` only after the user has confirmed the PR should be merged.
- When the user explicitly asks to merge an approved PR, Codex may use the GitHub API via `curl` to merge the PR, delete the remote branch, synchronize local `main`, and delete the local branch.
- The user has pre-approved this repository PR merge/cleanup workflow conceptually; still follow runtime approval prompts if the Codex environment requires them.
- After a PR is merged, delete the feature branch on GitHub and locally unless the user asks to keep it.
- Keep `main` clean and up to date before starting new work.
- Do not commit directly on `main`, except for explicit end-of-session updates to `docs/session-notes.md` requested by the user.
- All code, dependency, configuration, OpenSpec, and non-session-note documentation changes must follow the branch and pull request workflow.

## Review Workflow

- Before committing security-sensitive changes, prefer a local advisory security review of the uncommitted diff when a callable local tool is available, such as VS Code GitHub Copilot review or another explicit Copilot CLI integration.
- If no Copilot/VS Code review command is available in the Codex environment, say so and continue with normal verification plus any security review feedback the user provides manually.
- Treat advisory AI review as supplemental. Do not replace deterministic checks such as unit tests, production build, and direct code inspection.
