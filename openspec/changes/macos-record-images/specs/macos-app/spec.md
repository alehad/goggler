## ADDED Requirements

### Requirement: Watchlist and Purchases rows show validated item thumbnails

The macOS app SHALL render an item's `imageUrl` as a thumbnail on Watchlist and Purchases rows only after validating it is an HTTPS URL on a trusted eBay image CDN host, falling back to a placeholder icon otherwise — mirroring the same validation the web app already applies (`safeEbayImageUrl`).

#### Scenario: A valid eBay CDN image URL renders as a thumbnail

- **GIVEN** an item's `imageUrl` is an `https://i.ebayimg.com/...` URL
- **WHEN** the row renders
- **THEN** the thumbnail SHALL be loaded and displayed

#### Scenario: An untrusted or malformed URL falls back to a placeholder

- **GIVEN** an item's `imageUrl` is non-HTTPS, points at a local/private host, points at a non-eBay-CDN host, or is malformed
- **WHEN** the row renders
- **THEN** the placeholder icon SHALL be shown instead
- **AND** no request SHALL be made to that URL
