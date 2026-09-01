# Tasks: Item thumbnail images on macOS

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Add `safeEbayImageURL` (`Networking/SafeExternalURL.swift`), with unit tests mirroring `safe-external-url.ts`'s own coverage.
- [x] Render thumbnails in `WatchlistView`'s `HistoryItemRow` and `PurchasesView`'s `PurchaseRow`, falling back to the existing placeholder iconography.
- [x] `xcodebuild build` and `xcodebuild test` clean (20/20).
- [x] Manual functional confirmation (user): Watchlist and Purchases show real thumbnails for items that have them.
- [x] Run dual security review (security-review skill + Copilot CLI), then ship via PR. Both clean — no HIGH/MEDIUM findings; the internal review specifically verified `URLComponents`' spec-compliant parsing prevents userinfo confusion (`https://ebayimg.com@evil.com/...` correctly resolves `.host` to `evil.com`, rejected). Copilot flagged the same scenario as a defensive-hardening suggestion (not a confirmed bypass) — applied anyway for exact parity with the TS original (strips userinfo/hash before returning), free to do.
