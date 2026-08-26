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

## Manual Testing Against Production eBay

- Meaningful manual testing requires Production eBay OAuth, which requires a public HTTPS callback URL — `localhost` cannot complete a real eBay login. Default to standing up the Tailscale Funnel tunnel and sharing that URL whenever a manual test link is needed (including the "manual functional testing pause" step below), unless the user explicitly says to test locally instead.
- Which tunnel's hostname the app trusts for the OAuth redirect is controlled by `GOGGLER_TUNNEL_TARGET` (`src/http/origin.ts`): defaults to `tailscale` when unset, or set to `ngrok` to use the ngrok fallback below. Each target's exact expected hostname comes from `GOGGLER_TAILSCALE_HOSTNAME`/`GOGGLER_NGROK_HOSTNAME` in `.env.local` — matched exactly, not by suffix, since `.ts.net`/`.ngrok-free.dev` are shared public suffixes, not exclusively ours.

### Tailscale (default): tailnet-only app, narrowly-funneled callback

Only the eBay OAuth callback path is ever reachable from outside the tailnet. The rest of the app — UI, all other API routes — is served only to tailnet members, via a **two-port split**: the primary port carries the app via `serve` (no Funnel), and a separate port carries only the callback path via `funnel`. This is stronger than the ngrok setup below, which gates the app behind "any Google account" rather than tailnet membership.

- Requires the `goggler-dev` dev server already running on port 3000, and Tailscale installed, signed in, and connected (`tailscale status`). For day-to-day use, both are kept up persistently — see "Persistent local backend" under Deployment below; Tailscale no longer needs starting per session.
- Primary app origin (tailnet-only, port 443): `tailscale serve --bg --set-path=/ http://127.0.0.1:3000`. Reachable at `https://goggler.tailde35d2.ts.net`, matching `GOGGLER_TAILSCALE_HOSTNAME` in `.env.local`.
- Callback only (public, port 8443): `tailscale funnel --https=8443 --bg --set-path=/api/auth/ebay/callback http://127.0.0.1:3000/api/auth/ebay/callback`. **The path must be repeated in both `--set-path` and the backend target URL** — a bare-origin target (no path) makes Tailscale strip the path and always forward to the backend's root, silently breaking the callback (confirmed live: it returns the app's own 404 page instead of the route handler's response).
- Funnel must be enabled once per tailnet via the admin console (the CLI prints an enablement link the first time if it isn't).
- Verify isolation any time this is reconfigured: `tailscale funnel status --json` — `AllowFunnel` should list only the `:8443` entry, never `:443`.
- Stop both when done (`tailscale serve --https=443 off`, `tailscale funnel --https=8443 off`, or `tailscale serve reset && tailscale funnel reset`) and disconnect Tailscale (`tailscale down`) rather than leaving it connected between sessions.
- `EBAY_PRODUCTION_REDIRECT_URI`'s registered RuName in the eBay Developer Portal must have its accepted/declined URLs pointed at the `:8443` callback URL (`https://goggler.tailde35d2.ts.net:8443/api/auth/ebay/callback`). If the tailnet name or device hostname ever changes, both `GOGGLER_TAILSCALE_HOSTNAME` and the eBay portal URLs need updating to match.

### ngrok (fallback via `GOGGLER_TUNNEL_TARGET=ngrok`)

- Start the tunnel from the repo root: `ngrok http 3000 --traffic-policy-file ngrok/oauth.yml` (requires the `goggler-dev` dev server already running on port 3000).
- Reserved public URL: `https://unrigged-fifth-nastily.ngrok-free.dev`. This is gated by Google OAuth at the tunnel edge (`ngrok/oauth.yml`, `auth_id: goggler-dev`) before any request reaches localhost — the user authenticates with Google first, then reaches the app.
- If ngrok reports an invalid OAuth state, reset it: `https://unrigged-fifth-nastily.ngrok-free.dev/ngrok/logout?auth_id=goggler-dev`.
- If the full edge gate ever breaks eBay's OAuth callback (`code`/`state` round-trip), `ngrok/oauth-callback-fallback.yml` is the documented fallback policy — it exempts only `/api/auth/ebay/callback`, relying on the app's own signed-state protection there.
- `EBAY_PRODUCTION_REDIRECT_URI` in `.env.local` must match the ngrok callback URL (`https://unrigged-fifth-nastily.ngrok-free.dev/api/auth/ebay/callback`). If the reserved domain ever changes, the eBay Developer Portal's accepted/declined RuName URLs must be updated to match, along with `GOGGLER_NGROK_HOSTNAME`.

## Deployment

There are two ways to run goggler: a **persistent local backend** for day-to-day use (this Mac, always up), and an **on-demand Docker image** for portable, start-when-wanted use elsewhere. Docker/a Tailscale sidecar for the persistent case was considered and deliberately rejected — it would add a new stored secret (`TS_AUTHKEY`) and meaningfully more moving parts for a single-user personal app, and testing showed neither was actually needed: Tailscale being connected never exposes Funnel on its own (Funnel is a separate, explicit per-port opt-in), and a `tailscale serve` mapping already survives a reconnect without being re-applied. See [[persistent-backend-launchagent]] for the full design.

### Persistent local backend (day-to-day use)

- The Next.js server runs via a `launchd` LaunchAgent (`~/Library/LaunchAgents/com.goggler.server.plist`, machine-local, not tracked in this repo), started at login and restarted automatically if it exits. It runs the production build directly (`node .next/standalone/server.js`, matching the same `output: "standalone"` artifact the Docker image uses) rather than `next dev` or `next start` — `next start` warns it's incompatible with standalone output, and dev mode isn't meant to run unattended.
- **Env vars are loaded via Node's native `--env-file` flag** (`node --env-file=.env.local .next/standalone/server.js`) — standalone output does not do Next's usual automatic dotenv loading at runtime the way `next dev`/`next start` do, unlike Docker, which never needed this since it injects env vars directly via `docker run -e`. This parses `.env.local` as plain `KEY=VALUE` data only, the same way Docker's `--env-file` does — an earlier draft shelled out to `source .env.local` instead, which the security review correctly flagged: `source` executes the file as real shell script, so a secret value ever containing `` ` ``, `$(`, `;`, or `#` would be silently misinterpreted (command substitution, comment-truncation, or var expansion) rather than loaded as inert data.
- After any code or `.env.local` change: `npm run build`, then re-copy static assets into the standalone output (`rm -rf .next/standalone/.next/static && cp -R .next/static .next/standalone/.next/static` — standalone output doesn't include them by default, same extra copy step the `Dockerfile` already does), then restart the agent (`launchctl kickstart -k gui/$(id -u)/com.goggler.server`).
- Logs: `~/Library/Logs/goggler-server.log`.
- Tailscale itself stays connected via its own "Open at Login" preference (Tailscale.app → Settings) — not something this repo configures or manages. The existing `tailscale serve` mapping (tailnet-only, port 443) persists across reconnects on its own. Funnel (the public callback port) stays exactly as manual as described above — enabling it is a deliberate, separate action every time, never part of the persistent setup.

### On-demand Docker image (portable, multi-machine)

goggler also runs as a Docker image, on-demand rather than always-on — start it when you want to use the app, stop it when done, same usage shape as `next dev`. The same image is portable across machines (verified on this Mac and the user's iMac); only the env file and which machine's Tailscale identity is active differ.

- **Build**: `docker build -t goggler .` — multi-stage `Dockerfile`, Next.js `output: "standalone"` mode, non-root runtime user. No `.env*` file is ever baked into the image (`.dockerignore` excludes them) — all configuration comes from environment variables at container start.
- **Run**: `docker run --rm --name goggler -p 3000:3000 --env-file /path/to/goggler.env goggler` — the env file uses the exact same variable names as `.env.local` (see `.env.example`), typically with `GOGGLER_DB_TARGET=neon` regardless of which machine is running it, since the local Postgres target only makes sense on a machine that has it installed.
- **Access**: whenever the container is running, wire up Tailscale exactly as in "Manual Testing Against Production eBay" above — `tailscale serve` for the primary app (tailnet-only), `tailscale funnel` scoped to the callback path on a separate port. `GOGGLER_TAILSCALE_HOSTNAME` in the container's env file must match whichever machine is currently running it, and the eBay Developer Portal's registered callback URL must point at that same machine's `:8443` callback URL.
- **Sessions are not persisted across restarts** — this is expected, not a bug: the app's in-memory eBay session model (see "Security And Persistence Invariants" above) means a container restart requires signing back in with eBay, same as closing a browser tab does today.
- **Publishing to Docker Hub** (`.github/workflows/docker-publish.yml`): triggered only by pushing a tag matching `v*`, never by an ordinary merge to `main`. Publishes `alehad/goggler:<tag>` and `alehad/goggler:latest`. Requires `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` GitHub repository secrets (a Docker Hub access token, not the account password) — set up by the user directly, never handled by Claude. See step 8 of the Autonomous PR Workflow above for when a tag actually gets pushed.
- **Local dev (`next dev` + this Mac's Tailscale) remains the workflow for making changes** — the Docker image is for using the app day-to-day, not for iterating on it. Deploying a new build anywhere is a manual, explicit step, not automatic on every merge.

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
4. **Manual functional testing pause.** Stop and hand the feature to the user to exercise against Production eBay via the ngrok tunnel (see "Manual Testing Against Production eBay" above — start the tunnel and share that URL, not `localhost`, unless told otherwise). Do not proceed past this point on your own.
5. **User sign-off.** Wait for the user to explicitly confirm the feature works as intended.
6. **Security review — dual gate.** Once sign-off is received, run both:
   - Claude Code's built-in `security-review` skill against the diff, and
   - GitHub Copilot CLI, non-interactively:
     ```bash
     copilot -p "Review the current uncommitted git diff for security issues. Do not modify files. Return verdict, findings, and recommended fixes only." --silent --deny-tool='write' --deny-tool='shell(*)'
     ```
   The review passes only if neither raises a blocking finding. If either does, stop and get explicit user direction rather than committing. (ChatGPT is not part of this automated gate — no scriptable connector exists; if the user wants a ChatGPT opinion, that happens manually outside this pipeline.)
7. **Ship it.** Once the dual security review passes, commit, push, open the PR (`gh pr create`), and merge (`gh pr merge --squash --delete-branch`), then sync local `main` and delete the local feature branch — all without a further confirmation prompt.
8. **Ask about a Docker Hub version.** After the merge, ask the user whether this change warrants a new Docker Hub version. If yes, create and push the version tag (`git tag vX.Y.Z && git push origin vX.Y.Z`), which triggers `.github/workflows/docker-publish.yml`; if no, this step ends here. See "Deployment" below for the publishing pipeline itself.

This standing authorization covers only this exact lifecycle on feature branches following the OpenSpec-first workflow above. It does not extend to direct commits on `main` (other than the session-notes exception above), force-pushes, history rewrites, or skipping steps 2, 4, or 5 — those still require the user's explicit go-ahead each time.
