# Design: Fix Analytics filter row layout

## The fix

The first attempt at this fix (below, "v1") wrapped the two bulk-action buttons in `.section-heading-actions`, keeping them a separate flex group from `.filter-row`. That was a real improvement over the original bug (buttons no longer vertically-centered against a two-line-tall row with wrapping text), but it was still wrong: `.section-heading-actions` and `.filter-row` compete for space as two independently-constrained flex children of `.section-heading`, so at the app's actual content width the two buttons wrapped onto their own second column rather than sitting on the same line as the filter controls — a regression the user caught immediately (screenshot showed the buttons stacked to the right of two stacked filter rows).

**v1 (wrong — shipped briefly, corrected before merge):**

```tsx
<div className="section-heading">
  <div className="filter-row">
    <div className="segmented-control" aria-label="Capture status filter">...</div>
    <div className="segmented-control win-status-filter" aria-label="Win status filter">...</div>
  </div>
  <div className="section-heading-actions">
    {condition && <button>Capture all visible</button>}
    {condition && <button>Delete all visible</button>}
  </div>
</div>
```

**v2 (actual fix):** merge the buttons directly into `.filter-row` itself, as siblings of the two `.segmented-control` divs, so all four elements share one `flex-wrap` group with the full available width instead of two groups each getting half:

```tsx
<div className="section-heading">
  <div className="filter-row">
    <div className="segmented-control" aria-label="Capture status filter">...</div>
    <div className="segmented-control win-status-filter" aria-label="Win status filter">...</div>
    {condition && <button className="secondary-button compact capture-action">Capture all visible</button>}
    {condition && <button className="secondary-button compact capture-action danger-action">Delete all visible</button>}
  </div>
</div>
```

Measuring the real rendered widths at the app's actual max content width (`.content { max-width: 1180px }`, ~1120px available after padding) showed this alone still fell ~46px short of fitting all four elements on one line — the `win-status-filter` segmented control (4 buttons, sized equally by its CSS Grid `1fr` columns to match "Eventually won", the longest label) is inherently wide. Rather than touch the shared `.segmented-control button` padding globally (which would also tighten the Home tab's filters, the Lost-bid filter, and the relisting-format filter — a broader visual change than asked for), the padding reduction is scoped to this row only:

```css
.filter-row .segmented-control button {
  padding: 0 6px; /* was 12px via the shared .segmented-control button rule */
}
```

This closed the gap by ~38px in an isolated repro — but that repro's placeholder buttons were plain text, missing the real `<Check size={16} />`/`<Trash2 size={16} />` lucide icons each button actually renders before its label. Those icons plus the button's own `gap: 8px` (from the shared `.icon-button, .user-switch, .primary-button, .secondary-button` rule) add ~24px per button that the v2 repro never accounted for — so in the real app it still didn't fit, and the user caught it a second time from a live screenshot (three of the four elements fit; "Delete all visible" wrapped to its own line).

**v3 (final fix):** same JSX structure as v2 (merged into `.filter-row`), but rebuilt as a deliberately compact, purpose-built bar per the user's explicit spec — one line, same width as the search box/list above/below, all elements the same height, vertically centered, smaller font permitted:

```css
.filter-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.filter-row .segmented-control {
  flex-shrink: 0;
  margin-bottom: 0;
  padding: 3px;
}

.filter-row .segmented-control button {
  font-size: 12px;
  min-height: 28px;
  padding: 0 8px;
}

.filter-row .capture-action {
  flex-shrink: 0;
  font-size: 12px;
  min-height: 36px;
  padding: 0 9px;
}
```

The two `min-height` values (28px for segmented-control buttons, 36px for action buttons) aren't arbitrary — they're solved so both element *types* render at the same total height despite different box models. With `box-sizing: border-box` (global), a segmented-control's rendered height is its own `padding` (3px × 2) + `border` (1px × 2, from the shared `.segmented-control` rule) + its button's `min-height` = 3+3+1+1+28 = 36px — matching the action button's `min-height: 36px` (which already includes its own 1px border, no vertical padding) exactly. This was verified numerically, not assumed: `getBoundingClientRect()` on the real elements showed all four at exactly 36px tall, top-aligned to the same pixel.

This time verified against the *exact* real `app/styles.css` (copied fresh each iteration, not hand-edited in a separate file that could drift) with real icon-sized placeholder elements (16×16px + the button's own gap, matching lucide's actual rendered footprint) — so the ~24px-per-button gap that broke v2 couldn't happen again silently. Result: 51px of real width margin at the app's max content width (`.content { max-width: 1180px }`), comfortable enough to not be at risk from minor font-rendering differences across browsers/OSes.

## Verification method

This is a pure CSS/layout bug with no server-side or data component, so it doesn't fit this repo's usual unit/integration test shape. Verified with an isolated static HTML reproduction using the project's actual `app/styles.css` verbatim, with `getBoundingClientRect()` measurements (not eyeballing) at the app's real max content width — this caught the v1 regression before it shipped, but v2's repro was still incomplete (missing icon markup) and needed a live screenshot from the user to catch. v3's repro includes icon-sized placeholder elements specifically to close that gap. Also checked a narrow (~420px) viewport each round to confirm the row still wraps gracefully rather than overflowing.

The mic/chat feature's precedent applies here too: this is gated behind the Analytics tab's existing eBay-session requirement, so final confirmation happens on the real tab via Tailscale, not just the isolated repro. Also learned (again) mid-fix: running `npm run build` while the dev server is still live corrupts its `.next` cache (same incident as during [[analytics-ai-assistant]]) — stop the dev server before building, restart fresh after.
