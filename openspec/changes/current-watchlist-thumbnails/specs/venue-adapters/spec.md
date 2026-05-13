# Capability: Venue Adapters

## ADDED Requirements

### Requirement: Current live eBay watchlist

The eBay live history source SHALL only expose currently live eBay WatchList items as Home feed watchlist rows.

#### Scenario: Live WatchList includes ended items

- **GIVEN** eBay returns WatchList items with listing end times in the past and future
- **WHEN** the live history source builds the Home feed
- **THEN** only WatchList items with future listing end times SHALL be included in the watchlist section
- **AND** ended WatchList items SHALL NOT be counted as current watchlist items

### Requirement: Listing image extraction

The eBay Trading API adapter SHALL extract a listing thumbnail URL when eBay includes one in the item payload.

#### Scenario: WatchList item includes gallery image

- **GIVEN** eBay returns a WatchList item with a gallery image URL
- **WHEN** the adapter parses the item
- **THEN** the normalized item SHALL include the image URL without persisting it at rest
