# Tasks: Auto-select Postgres driver adapter by host (Neon vs local)

- [x] Create OpenSpec change documenting the design.
- [x] Add `@prisma/adapter-neon` dependency.
- [x] Verify Neon connectivity works over this network via the real adapter.
- [x] Wait for user sign-off on this design before implementing.
- [x] Implement `createAdapter` host-based branching in `src/persistence/prisma.ts`.
- [x] Add unit test(s) for adapter selection.
- [x] Run OpenSpec validation, unit tests, persistence integration tests, build.
- [x] Manual/functional confirmation — real end-to-end query against both Neon and local Postgres via the shipped `createPrismaClient`, both succeeded.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
