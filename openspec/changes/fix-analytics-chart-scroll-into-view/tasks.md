# Tasks: Scroll the Analytics chart into view when an item is selected

- [x] Create OpenSpec change documenting the fix.
- [x] Wait for user sign-off on this design before implementing.
- [x] Add an optional `id` prop to `PurchaseChart`, passed only from the Analytics tab call site (`id="analytics-chart-panel"`).
- [x] Retarget the existing `selectedItemId` scroll effect in the Analytics tab section from `analyticsRowDomId(selectedItemId)` to `"analytics-chart-panel"`, with `block: "start"` instead of `"center"`.
- [x] `npx tsc --noEmit`, `npm run build`, `npm run test:unit` (207/207), `npm run openspec:validate` (64/64).
- [x] Manual functional testing pause: user confirmed on the real Analytics tab. Found a follow-up issue — the chart's top (including the record-name heading) was still hidden behind the sticky `.topbar` after scrolling. Fixed by adding `scroll-margin-top: 100px` to `.purchase-chart-panel` (topbar measured at 89px real height + buffer). Re-verified — user confirmed "looks great."
- [x] Run dual security review (security-review skill + Copilot CLI), then ship via PR.
