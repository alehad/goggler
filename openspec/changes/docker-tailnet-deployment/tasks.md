# Tasks: Docker packaging + Docker Hub publishing pipeline

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Add `output: "standalone"` to `next.config.mjs`.
- [x] Add `Dockerfile` (multi-stage: build + slim runtime, non-root user). No `public/` directory exists in this repo, so that copy step was dropped from the original design.
- [x] Add `.dockerignore`.
- [x] Build the image locally on this Mac and run it (`docker run`), confirm `http://localhost:3001` serves the app correctly with only documented env vars. (Docker Desktop wasn't installed at the start of this task — user installed it, then this step proceeded.)
- [x] Add `.github/workflows/docker-publish.yml` (tag-triggered build + push to Docker Hub, `alehad/goggler`, tags `${{ github.ref_name }}` and `latest`).
- [x] Add the "Deployment" section to `AGENTS.md`, including the post-ship version-decision step (step 8 of the Autonomous PR Workflow).
- [x] Run OpenSpec validation (49/49), unit tests (191/191), build (`npm run build` and `docker build`) — all clean.
- [x] Manual functional confirmation, part 1 (this Mac): `docker run`, confirmed the app serves correctly, reads production eBay config, and reads real data from Neon (verified via `/api/market-insights/matched-sales` against a known record).
- [x] Manual functional confirmation (this Mac, full eBay OAuth): container wired up through the same two-port Tailscale setup as `next dev`, full production eBay login confirmed working end-to-end through the containerized app.
- [ ] Manual functional confirmation, part 2 (iMac): build or pull the same image there, run it, wire up Tailscale, confirm it works there too — this is what validates the packaging is actually portable. (Deferred — not blocking shipping the packaging/pipeline itself.)
- [ ] Manual functional confirmation, part 3 (publishing pipeline): confirm the `v0.1.0` tag push triggers the workflow and it publishes to Docker Hub correctly.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
