# Proposal: Docker packaging + Docker Hub publishing pipeline

## Why

Today goggler only runs as `next dev`, started manually whenever it's needed. The user wants it packaged as a Docker image instead, runnable on-demand on whichever machine they choose — this Mac now, their home iMac too, to validate the packaging actually works portably across machines. There's no need for an always-on host: the user is happy to start the container, log in, run "Find & watch new auctions" or browse, and stop it when done — the same usage pattern as `next dev` today, just packaged differently. Access when it *is* running still goes through the same tailnet Serve/Funnel model already built.

On top of that, the user wants a **Docker Hub publishing pipeline** via GitHub Actions, so a shipped feature can be packaged and pushed to their Docker Hub account as a versioned image, mirroring a CI/CD pattern they've used successfully before.

**This still does not deliver unattended daily automation.** Nothing about Docker packaging changes the `AGENTS.md` invariant against persisting eBay OAuth credential material — a container holds an eBay-authenticated session only in memory, same as `next dev` does now, and loses it whenever it restarts. That's an accepted, unrelated tradeoff, not something this change tries to solve.

## What Changes

- **Docker packaging**: a `Dockerfile` using Next.js's `output: "standalone"` mode (added to `next.config.mjs`), `prisma generate` at build time, running as a non-root user. A `.dockerignore` excludes `node_modules`, `.next`, `.git`, and all `.env*` files — no secrets baked into the image; configuration comes entirely from environment variables supplied at container start, reusing every variable already established (`GOGGLER_DB_TARGET`, `GOGGLER_TUNNEL_TARGET`, `GOGGLER_TAILSCALE_HOSTNAME`, eBay credentials, auth secret) — no new configuration mechanism.
- **On-demand, not always-on**: documented as `docker run` (started when wanted, stopped when done), the same tailnet Serve/Funnel commands from [[tailscale-callback-port-isolation]] wired up each time it's running — identical topology to local dev, just optionally pointed at a container instead of `next dev`.
- **Docker Hub publishing pipeline**: a GitHub Actions workflow, triggered by pushing a git tag (`v*`), that builds the image and pushes it to the user's Docker Hub account. This mirrors the user's prior CI/CD experience while keeping the *decision* of when to cut a new version manual and separate from the build mechanism itself.
- **Process change (not code)**: after shipping a PR under the existing autonomous "Ship it" workflow, Claude asks whether the shipped change warrants a new Docker Hub version. If yes, Claude creates and pushes the git tag (triggering the pipeline); if no, nothing changes about the existing ship flow. This is a small addition to `AGENTS.md`'s documented lifecycle, not a new workflow of its own.
- **Docker Hub credentials**: a Docker Hub access token stored as GitHub repository secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`) — set up by the user directly (via `gh secret set` in their own terminal, or the GitHub web UI), never typed into this conversation.

## Open Questions To Resolve Before Implementing

- **Docker Hub repository name** — proposing `alehad/goggler` (matches the GitHub handle and repo name) unless the user wants something else.
- **Version numbering** — `package.json` is currently at `0.1.0`; proposing the first published tag be `v0.1.0` to match, then subsequent versions decided collaboratively each time Claude asks post-ship.
- **Database migrations when running on a different machine** (the iMac): `prisma migrate deploy` needs raw TCP to Neon, which was blocked on this Mac's network. Whether the iMac has the same restriction is untested — if blocked, falls back to the manual SQL-replay approach already used once for the initial Neon migration ([[neon-db-adapter]]). Only matters once the schema changes again; today's schema is already fully migrated on Neon.

## Out of Scope

- An always-on host or persistent deployment — deliberately dropped in favor of on-demand, portable container usage.
- Automating the eBay-OAuth-dependent background job to run without a human present — still blocked by the kept OAuth-persistence invariant.
- Auto-publishing to Docker Hub on every merge — publishing is tag-triggered and tag creation is a deliberate, asked-about decision each time.
- The macOS native app — deliberately sequenced after this.

## Success Criteria

- `docker build` produces a working image; `docker run` (with the documented env vars) serves the app identically to `next dev`, verified on both this Mac and the iMac.
- Pushing a `v*` tag triggers the GitHub Actions workflow, which builds and pushes a correctly-tagged image to the user's Docker Hub repository.
- The eBay OAuth callback continues to work end-to-end through the tailnet-funneled port when the container is running, same as validated locally with `next dev`.
- No Docker Hub credential value ever appears in this conversation, the repository, or the image itself.
