# Tasks: Fix Analytics captured status resetting on tab switch

- [x] Create OpenSpec change documenting the bug and fix.
- [x] Add `markItemsCaptured` to `Home`; wire `onItemsCaptured` prop into `Analytics`.
- [x] Remove `Analytics`-local `locallyCapturedIds` state and its merge into the `items` memo.
- [x] Run OpenSpec validation, unit tests, build.
- [x] Manual functional test against Production eBay before requesting sign-off.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
