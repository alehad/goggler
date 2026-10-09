# Tasks: macOS Analytics matched-sales price chart

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Add `MatchedSalePoint`/`MatchedSalesSummary`/`MatchedSalesResponse` to `GogglerModels.swift`.
- [x] Add `queryItems` support to `GogglerAPIClient.request`/`requestDecoded`; confirm no existing call site is affected (all pass plain paths today).
- [x] Add `selectedItemId`/`matchedSalesState` to `AnalyticsView`; wire row tap-to-select (and visual selected state) onto `AnalyticsRow`.
- [x] Fetch matched sales via `.task(id: selectedItemId)`, gated on `relistingGroupId`/`currentPrice.currency` being present.
- [x] New `AnalyticsChart.swift`: Swift Charts scatter plot, won/not-won color distinction, selected-point distinction, tap-to-select via `chartOverlay` nearest-point hit testing, the four empty/loading states.
- [x] Metrics row (Sales / my price paid / Average / Lowest / Highest), reusing the existing `metric()` helper.
- [x] Scroll-into-view via `ScrollViewReader` on selection change.
- [x] Update `AnalyticsView.swift`'s stale header comment (no longer deferring the chart, or the already-shipped AI assistant).
- [x] New `GogglerModels` decode tests for the matched-sales response shape; unit tests for the pure date-parsing helper. **Found and fixed a real bug this way**: `analyticsChartPointDate`'s first draft used a bare `ISO8601DateFormatter()`, which fails to parse a Prisma-serialized `endedAt` (fractional seconds, `.000Z`) — a decode test against that exact shape failed immediately, before any manual testing caught it. Fixed by trying the plain format first, then falling back to a `.withFractionalSeconds` formatter. `analyticsChartNearestPoint` was left untested — it takes a real `ChartProxy`/`GeometryProxy`, which Swift Charts gives no way to construct outside a rendered view, the same category of gap this codebase already accepts for `EbayAuthService`'s live OAuth exchange and `VoiceInputService`'s audio lifecycle.
- [x] `xcodegen generate`, `xcodebuild build`, `xcodebuild test` clean — 41/41 (35 existing + 6 new).
- [x] Manual functional testing pause. User confirmed: "it works, let's ship it."
- [x] Run dual security review (security-review skill + Copilot CLI). The security-review skill's own diff capture was stale (showed only the already-committed OpenSpec docs, not the actual uncommitted Swift changes) — reviewed the real diff manually against the same methodology instead. Both clean: no SQL/command/injection surface (native Swift, typed `Decodable` models, no raw string URL concatenation — `queryItems` goes through `URLComponents`/`URLQueryItem`, which percent-encodes correctly), no new auth/session bypass (reuses the same cookie-based `GogglerAPIClient` session + Origin-header CSRF protection every other call already uses), no secrets or PII newly logged (`AppLog.network.error` logs only `String(describing: error)`, same pattern `askAssistant()` already uses). Copilot CLI: "No actionable security issues identified."
- [x] Ship via PR.
