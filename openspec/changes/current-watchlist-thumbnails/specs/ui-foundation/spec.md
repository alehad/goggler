# Capability: UI Foundation

## ADDED Requirements

### Requirement: Watchlist item thumbnails

The Home feed SHALL use listing thumbnails to identify active eBay watchlist items when image URLs are available.

#### Scenario: Watchlist row has an image

- **GIVEN** a Home feed watchlist row has an image URL
- **WHEN** the row is rendered
- **THEN** the card SHALL show the item image instead of the numeric watchlist position

#### Scenario: Watchlist row has no image

- **GIVEN** a Home feed row has no image URL
- **WHEN** the row is rendered
- **THEN** the card SHALL show a compact icon fallback
