# Tasks: Named, startup-selectable database target (default Neon)

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Implement `resolveDbTarget`/`resolveDatabaseUrl` in `src/persistence/prisma.ts`; wire into `getPrismaClient`.
- [x] Add unit tests for target resolution (unset/local/neon/invalid).
- [x] Document `GOGGLER_DB_TARGET` in `.env.example`.
- [x] Run OpenSpec validation, unit tests, persistence integration tests, build.
- [x] Fix integration test DB-target pollution regression discovered during testing (see design.md "Testing"); re-verify Neon data integrity.
- [x] Manual functional confirmation (`getPrismaClient()` against unset/neon/local targets, each in a fresh process).
- [ ] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
