# Design: Docker packaging + Docker Hub publishing pipeline

## `next.config.mjs`

```js
const nextConfig = {
  allowedDevOrigins: ["*.ngrok-free.dev"],
  output: "standalone"
};
```

`output: "standalone"` makes `next build` produce a minimal `.next/standalone` directory containing only the traced dependencies actually needed at runtime (not the full `node_modules`), plus a `server.js` entry point — this is what keeps the final image small and avoids needing `npm install` in the runtime stage at all.

## `Dockerfile`

Multi-stage build: a build stage with the full toolchain, a slim runtime stage with only what's needed.

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S goggler && adduser -S goggler -G goggler
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER goggler
EXPOSE 3000
CMD ["node", "server.js"]
```

- The Prisma-generated client (`src/generated/prisma`, gitignored, produced by `prisma generate` in the build stage) is picked up automatically by Next.js's dependency tracing into `.next/standalone` — no separate copy step needed.
- No `public/` directory exists in this repo, so there's nothing to copy there — if one's ever added, this Dockerfile would need a `COPY --from=build /app/public ./public` line added.
- Runs as a non-root user (`goggler`) in the runtime stage.
- No `.env*` file is ever copied into the image (enforced by `.dockerignore` below) — every configuration value comes from the environment the container is started with.

## `.dockerignore`

```
node_modules
.next
.git
.env
.env.*
*.log
openspec
```

## Runtime configuration

Unchanged from local dev — the same environment variables, just supplied via `docker run --env-file <path>` (or `-e` flags) instead of `.env.local`:

```
DATABASE_URL=...
NEON_DATABASE_URL=...
GOGGLER_DB_TARGET=neon
GOGGLER_AUTH_SECRET=...
GOGGLER_TUNNEL_TARGET=tailscale
GOGGLER_TAILSCALE_HOSTNAME=<whichever machine's tailnet hostname is running the container>
EBAY_ENVIRONMENT=production
EBAY_PRODUCTION_CLIENT_ID=...
EBAY_PRODUCTION_CLIENT_SECRET=...
EBAY_PRODUCTION_REDIRECT_URI=...
EBAY_PRODUCTION_OAUTH_SCOPES=...
EBAY_MARKETPLACE_ID=EBAY_GB
EBAY_TRADING_SITE_ID=3
GOGGLER_EBAY_HISTORY_SOURCE=live
```

`GOGGLER_DB_TARGET=neon` (or simply leaving it unset, since that's the default) is what actually gets used here regardless of which machine runs the container — the local Postgres target only ever made sense on this Mac, which has it installed; Neon is reachable from anywhere.

## Running it — on-demand, not always-on

```bash
docker build -t goggler .
docker run --rm \
  --name goggler \
  -p 3000:3000 \
  --env-file /path/to/goggler.env \
  goggler
```

Started when wanted, `Ctrl+C`'d or `docker stop`'d when done — the same usage shape as `next dev` today, just packaged as a container. No restart policy, no supervision daemon — there's nothing to keep alive since nothing needs to be always-on. The same image runs identically on this Mac or the iMac; only the env file and the machine's own Tailscale identity differ between them.

## Tailscale wiring, whenever the container is running

Identical topology and identical commands to [[tailscale-callback-port-isolation]]'s local dev setup, just pointed at the container's published port instead of `next dev`'s:

```bash
tailscale serve --bg --set-path=/ http://127.0.0.1:3000
tailscale funnel --https=8443 --bg --set-path=/api/auth/ebay/callback http://127.0.0.1:3000/api/auth/ebay/callback
```

Same caveat already documented in `AGENTS.md`: the path must appear in both `--set-path` and the backend target URL, or Tailscale silently strips it and forwards to the container's root.

`GOGGLER_TAILSCALE_HOSTNAME` in the container's env file must match whichever machine is currently running it (this Mac's `goggler.tailde35d2.ts.net`, or the iMac's own device name once that's tested) — and if the iMac is used with Tailscale Funnel active there too, the eBay Developer Portal's registered callback URL needs updating to match whichever machine is live at the time, same manual external step as every prior tunnel-hostname change. In practice, only one machine is likely to have an active eBay session at a time, so this is a "whichever one you're using right now" setting, not something both machines need simultaneously.

## Database migrations

`prisma migrate deploy` needs raw TCP to Neon (port 5432), which was blocked on this Mac's network — untested whether the iMac has the same restriction. Plan: try `prisma migrate deploy` from the iMac first; if it's blocked the same way, fall back to the manual SQL-replay approach already used once for the initial Neon migration (documented in [[neon-db-adapter]]'s design.md). This only matters once the schema changes again — today's schema is already fully migrated on Neon, so it doesn't block getting the container running on the iMac at all, only future schema changes applied from there.

## GitHub Actions: Docker Hub publishing pipeline

`.github/workflows/docker-publish.yml`, triggered only by pushing a tag matching `v*`:

```yaml
name: Publish Docker image

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            alehad/goggler:${{ github.ref_name }}
            alehad/goggler:latest
```

- Triggered by tag push only — nothing publishes on an ordinary merge to `main`.
- `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` are GitHub repository secrets the user sets up themselves (`gh secret set DOCKERHUB_TOKEN --repo alehad/goggler`, or the GitHub web UI) — a Docker Hub **access token**, not the account password, scoped to push access only. Claude never sees or handles the actual secret value.
- Publishes two tags per run: the exact version (`v0.1.0`, etc.) and a floating `latest` pointing at the most recently published version — a normal, low-risk convention (`latest` only moves on an explicit, human-decided publish, not on every commit).

## The version-decision step (process, not code)

Added to `AGENTS.md`'s existing autonomous "Ship it" step: **after** merging a PR under that pre-authorized workflow, Claude asks the user whether the shipped change warrants a new Docker Hub version. If yes, Claude creates and pushes the git tag (`git tag vX.Y.Z && git push origin vX.Y.Z`), which triggers the workflow above; if no, nothing further happens. This keeps the existing PR-merge autonomy exactly as it is today — it only adds one question at the very end, not a new approval gate earlier in the flow.

## AGENTS.md

New "Deployment" section, positioned after "Manual Testing Against Production eBay":

- The `docker build`/`docker run` commands above, framed explicitly as on-demand (not always-on).
- The Tailscale serve/funnel commands, cross-referencing the existing manual-testing section rather than duplicating the path-quirk explanation.
- A reminder that `GOGGLER_TAILSCALE_HOSTNAME` and the eBay Developer Portal's registered callback URL both need to match whichever machine is currently running the container.
- The Docker Hub publishing pipeline: what triggers it, and the new post-ship version-decision step described above.

## Testing

- `docker build` succeeds locally (on this Mac) and the resulting image runs (`docker run` locally, verify `http://localhost:3000` serves the app) — proves the Dockerfile/standalone-output setup works before testing on the iMac at all.
- Manual confirmation on the iMac: pull or build the same image, run it there, wire up Tailscale the same way, confirm full eBay OAuth login + a real market-insights action works end-to-end — this is what actually validates "the package is portable," which is the point of testing on a second machine.
- Manual confirmation of the publishing pipeline: push a `v0.1.0` tag, confirm the GitHub Actions workflow runs and the image appears on Docker Hub under both `v0.1.0` and `latest`, without any secret value ever appearing in workflow logs.
