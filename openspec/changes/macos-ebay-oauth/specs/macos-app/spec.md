## ADDED Requirements

### Requirement: The macOS app can connect a real eBay account

The macOS app SHALL let the user connect their eBay account via the system authentication UI (`ASWebAuthenticationSession`), completing the same OAuth flow the web app uses, and adopt the resulting authenticated session so subsequent backend requests reflect the connection immediately.

#### Scenario: Connecting eBay from the Home tab

- **GIVEN** the Home tab shows eBay as not connected
- **WHEN** the user selects "Connect eBay" and completes a real login in the system authentication sheet
- **THEN** the sheet SHALL close automatically on completion
- **AND** the app's own backend requests SHALL immediately reflect a connected eBay session, with no separate manual step

#### Scenario: A failed or cancelled login leaves the app in a clear state

- **GIVEN** the user cancels the system authentication sheet, or the flow fails
- **WHEN** the sheet closes
- **THEN** the app SHALL show that eBay is still not connected
- **AND** SHALL NOT show a false "connected" state or hang waiting for a response that will never arrive
