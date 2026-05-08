# Design: eBay-inspired responsive UX

## Reference Patterns

Public eBay help and app listing material point to these stable product patterns:

- Search is central on the app home screen.
- Buyer activity is organized around My eBay, Watching/Watchlist, Purchases/Purchase history, saved searches, and account settings.
- Mobile app navigation exposes My eBay from the lower part of the home experience.
- Search and listing results rely on sort/filter controls.
- Purchase history is a central management surface for past orders.

goggler should adapt these conventions to its narrower purpose: tracking lost auction items and reviewing likely relistings.

## Information Architecture

Use four primary destinations:

- Home: candidate relistings, review queue, and high-level activity.
- Watching: not-won auction items the user is tracking.
- Purchases: won imported items and future purchase analytics.
- My goggler: local account, eBay connection, import setup, and matching preferences.

This maps well to future iPhone tabs while keeping the desktop header focused on brand, search, setup state, filters, and account access.

## Layout Direction

### Desktop

- Use a persistent bottom navigation dock for primary destinations.
- Keep a sticky top search and filters row.
- Use dense content panels rather than marketing-style cards.
- Candidate listings should read like marketplace results, not dashboard widgets.

### Mobile

- Use the same fixed bottom tab bar with the four primary destinations.
- Keep top search available above content.
- Use single-column listing rows with stable image dimensions and compact metadata.
- Avoid oversized headings and decorative blocks on small screens.

## Listing Row Pattern

Candidate and historical item rows should include:

- Square thumbnail/art placeholder.
- Title and artist/category line.
- Price context: current bid, lost bid, or paid price.
- Condition and seller/location metadata when known.
- Ending time or import/history status.
- Quick actions with icon buttons.

Rows should be scannable and stable in height; controls should not shift layout as content changes.

## Account Pattern

My goggler should feel like an account/preferences hub:

- Local profile row.
- eBay UK connection row with real status and Connect/Disconnect action.
- Sandbox/config status where relevant.
- Matching preferences row.
- Future import/preferences rows can be added here without redesign.

## Visual Direction

- Use a light marketplace palette with restrained borders, white content surfaces, blue action accents, and status colors.
- Keep the goggler brand mark small and distinct.
- Do not use eBay logos, brand colors as a direct four-color system, or exact screen layouts.
