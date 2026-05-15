# Capability: eBay Buying History

## ADDED Requirements

### Requirement: Home feed thumbnails for all item classes

The buying-history response SHALL preserve safe item image URLs for all Home feed rows when the source item includes one.

#### Scenario: Lost bid row has a source image

- **GIVEN** a lost-bid item has a safe image URL
- **WHEN** the Home feed is built
- **THEN** the corresponding unresolved or relisting row SHALL include that image URL

#### Scenario: Resolved lost-bid row has a source image

- **GIVEN** a lost-bid item that was eventually won has a safe image URL
- **WHEN** the Home feed is built
- **THEN** the corresponding resolved row SHALL include that image URL

#### Scenario: Won row has a source image

- **GIVEN** a won item has a safe image URL
- **WHEN** the Home feed is built
- **THEN** the corresponding won row SHALL include that image URL

### Requirement: Won items in Home feed

The buying-history response SHALL expose won items in the Home feed when eBay returns won buying history.

#### Scenario: Won history exists

- **GIVEN** the eBay buying history source returns won items
- **WHEN** the Home feed is built
- **THEN** Home feed rows SHALL include won item rows
- **AND** Home feed counts SHALL include the won item count

#### Scenario: Unsafe source image

- **GIVEN** the source item contains an unsafe image URL
- **WHEN** the buying-history item is parsed
- **THEN** the unsafe image URL SHALL be omitted before the Home feed is built
