# Change: Add OpenSpec CLI tooling

## Why

The repository uses OpenSpec for planning, but the validator is not installed as a project dependency. That makes validation dependent on ad hoc global or `npx` usage and caused ambiguity about the correct package name.

## What Changes

- Add the official OpenSpec CLI package as a development dependency.
- Add a repeatable npm script for strict, non-interactive OpenSpec validation.
- Fix the existing testing-ci OpenSpec wording issue so the validation script has a clean baseline.

## Out Of Scope

- Archiving completed OpenSpec changes.
- Adding GitHub Actions validation gates.
- Changing the implementation workflow beyond making validation locally repeatable.

## Success Criteria

- Developers can run OpenSpec validation with `npm run openspec:validate`.
- Strict OpenSpec validation runs without requiring a global CLI installation.
- The active OpenSpec change set validates successfully.
