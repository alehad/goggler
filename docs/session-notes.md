# Session Notes

These notes capture working context that should survive moving between machines or resuming after a long break. They are not formal requirements; formal behavior belongs in OpenSpec.

## Current Project

- Project name: `goggler`
- GitHub repository: `https://github.com/alehad/goggler`
- Primary local path on iMac: `/Users/saja/GitHub/goggler`
- Development workflow: short-lived `codex/` branches, PR review, merge to `main` after user approval, then delete local and remote feature branches.

## Product Direction

goggler is a personal-first eBay UK auction tracker. It helps the user find auction items that reappear after the user bid on them but did not win.

Initial scope:

- Single-user intent, but with a real app `User` concept from day one.
- eBay UK first.
- Import authenticated eBay buying history.
- Track not-won auction items.
- Search for likely exact relistings.
- Show candidates in an in-app dashboard.
- Preserve won-item data for later purchase analytics.

## Architecture Decisions So Far

- Use OpenSpec for spec-driven development.
- Keep marketplace-specific behavior behind a trading venue adapter layer.
- Start with eBay, but design the adapter boundary so other venues can be added later.
- Recommended app stack is TypeScript, Next.js, PostgreSQL, Prisma, and a simple job/worker approach.
- Initial matching should be deterministic and explainable before adding AI-assisted or image-based similarity.

## UI Direction

An initial UI foundation has been merged to `main`.

It includes:

- Next.js TypeScript scaffold files.
- A dependency-free static prototype under `prototype/`.
- Tabs for Dashboard, Tracking, Won, and Account.
- Mock vinyl-record auction data.
- Candidate relisting cards with confidence, pricing context, matching signals, ending time, and review actions.

The static prototype can be opened directly from `prototype/index.html` or served locally from the `prototype/` folder.

## Cross-Machine Resume Notes

The Codex chat may or may not carry across machines, but the repository should be treated as the durable source of context.

When moving to another Mac:

1. Clone `https://github.com/alehad/goggler`.
2. Tell Codex the local repo path on that machine.
3. Ask Codex to inspect `AGENTS.md`, `openspec/project.md`, `docs/session-notes.md`, and current Git state before continuing.
4. Continue from `main` unless an active branch is intentionally in progress.

## Next Likely Steps

- Decide whether to refine the mock UI further or turn the scaffold into the actual running Next.js app.
- Confirm package manager/tooling availability on the active machine.
- Add formal OpenSpec changes for app scaffolding, local user model, and eBay adapter validation.

