# Change: Upgrade Next.js security fix

## Why

`npm audit --omit=dev` reports high-severity advisories against the current `next@15.5.15` dependency. The audit fix target is `next@15.5.18`, so the framework dependency should be upgraded in a focused security branch.

## What Changes

- Upgrade Next.js to the patched 15.5.x release recommended by npm audit.
- Refresh the lockfile for the dependency change.
- Verify the app still typechecks and the unit suite continues to pass.
- Confirm the production dependency audit no longer reports the Next.js high-severity finding.

## Out Of Scope

- Broad framework refactoring.
- Upgrading React or unrelated dependencies.
- Changing app behavior or eBay integration logic.

## Success Criteria

- `npm audit --omit=dev` reports no high-severity production dependency vulnerabilities for Next.js.
- Existing unit tests and TypeScript checks pass.
- OpenSpec validation remains green.
