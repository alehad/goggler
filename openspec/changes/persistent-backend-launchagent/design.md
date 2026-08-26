# Design: Persistent local backend via a launchd LaunchAgent

## The plist (final, as implemented)

`launchd` (not Docker, not a shell script run manually) is the standard macOS mechanism for "start this at login, restart it if it dies" — no new runtime, no new secret storage, nothing beyond what's already on this Mac. This is the actual final shape, after two rounds of empirical correction (see below):

```xml
<!-- ~/Library/LaunchAgents/com.goggler.server.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.goggler.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>--env-file=.env.local</string>
        <string>.next/standalone/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/ahadzic/GitHub/goggler</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/ahadzic/Library/Logs/goggler-server.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/ahadzic/Library/Logs/goggler-server.log</string>
</dict>
</plist>
```

Notes:

- `ProgramArguments` uses `node`'s absolute path (`/opt/homebrew/bin/node`, confirmed via `which node` on this Mac) — `launchd` doesn't inherit an interactive shell's `PATH`, so a bare `node` would fail to resolve.
- `KeepAlive: true` restarts the process if it exits for any reason (crash, `kill`, etc.) — the persistence guarantee the proposal asks for. Verified empirically: killed the process, `launchd` had a new PID serving correctly within ~3 seconds.
- Logs go to `~/Library/Logs/goggler-server.log` rather than nowhere, matching this project's established preference (from the macOS app work) for diagnosability over a silent process — `tail -f ~/Library/Logs/goggler-server.log` is the equivalent of watching `next dev`'s terminal output.

## Two things the initial design got wrong, found by testing before shipping

**`next start` doesn't actually work with `output: "standalone"`.** The initial plan ran `npm run start` (`next start`). It printed `⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead` — and while it happened to still serve correctly in a quick check, that's exactly the kind of Next.js-flagged mismatch not worth trusting long-term. Switched to running the standalone server directly, matching what the `Dockerfile` already does. This surfaced two follow-on gaps, both caught by testing rather than assumed away:

- **Static assets are missing from the standalone output by default** (`.next/standalone/.next/static` doesn't exist after a plain `next build`) — same reason the `Dockerfile` has an explicit extra `COPY --from=build /app/.next/static ./.next/static` step. Fixed the same way here: `rm -rf .next/standalone/.next/static && cp -R .next/static .next/standalone/.next/static` after every build.
- **Standalone output does not do Next's automatic dotenv loading** the way `next dev`/`next start` do. First attempt: wrap the command in a shell (`set -a; source .env.local; set +a; exec node ...`) — worked, confirmed via a live env-dependent endpoint (`config-status` correctly went from `"environment": "sandbox", missing: [...]` to `"environment": "production", missing: []`). **The internal security-review agent then correctly flagged this**: `source` executes `.env.local` as real shell script, not as inert `KEY=VALUE` data — unlike every other env-loading path already documented in this repo (Docker's `--env-file`, Next's own dotenv loader), which never interpret the file's contents. A secret value ever containing `` ` ``, `$(`, `;`, or `#` would be silently misinterpreted (command substitution, comment-truncation mid-value, or variable expansion) rather than loaded as data. Fixed by switching to Node's native `--env-file` flag (stable since Node 20.6; this Mac runs Node 22) — `node --env-file=.env.local .next/standalone/server.js`, no shell involved at all, plain `KEY=VALUE` parsing only. Re-verified the same env-dependent endpoint after the switch: still correct.

## Verifying without disrupting this session

A full logout/reboot is the real end-to-end test, but forcing one now would kill this very Claude Code session (it runs under the same login session) — not something to do without the user choosing to do it themselves. Instead, ran a full cold-state simulation: stopped the LaunchAgent (`launchctl bootout`) and disconnected Tailscale (`tailscale down`) together, confirmed both endpoints unreachable, confirmed the macOS app's startup gate correctly showed the "Can't reach goggler" overlay, then brought both back the way login would (`tailscale up` + `launchctl bootstrap`, the manual equivalents of Tailscale's "Open at Login" and the LaunchAgent's `RunAtLoad`), confirmed reachability recovered with zero manual `npm run dev`/`tailscale serve` commands, and confirmed a fresh app launch went straight into the sidebar with no gate delay. A real logout/reboot remains something the user can do at their own convenience to confirm the actual login-time triggers, but this simulation exercises the same code paths.

## Tailscale "Open at Login"

Purely a Tailscale.app preference (its menu bar icon → Settings, or Preferences → General → "Open at Login") — no file this repo owns, no code. Documented as a one-time manual step in `AGENTS.md` rather than automated, since it's a system preference toggle with no CLI equivalent worth scripting for a one-time action.

## Why the macOS app still can't do any of this itself

Came up mid-implementation: could the (App-Sandboxed) macOS app just start Tailscale/the server itself on launch, now that we've built the pieces? No — App Sandbox still blocks a sandboxed process from spawning arbitrary external executables (`launchctl`, `node`, `tailscale`), same constraint as when this was first discussed for [[macos-watchlist-and-startup-check]]. What actually changes with this LaunchAgent in place: the app no longer *needs* to start anything, because the backend and Tailscale now come up automatically at login, independent of whether the app is even open — decoupled lifecycles rather than the app owning either one. The startup gate stays as a safety net for the rarer case (something gets manually killed mid-session), not as the normal path anymore.
