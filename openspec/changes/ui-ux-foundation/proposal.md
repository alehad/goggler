# Change: UI UX foundation

## Why

Before building eBay integration and matching logic, the project needs an agreed app shape for the core review workflow. A visual mock app lets us validate navigation, density, item-card design, and review actions early.

## What Changes

- Introduce an initial Next.js mock UI with tabs for Dashboard, Tracking, Won, and Account.
- Use realistic mock auction data focused on vinyl records.
- Establish a marketplace-inspired visual direction without copying eBay branding.
- Define the first dashboard review flow for candidate relistings.
- Add UI requirements for the initial app shell and tab behavior.

## Out Of Scope

- Real authentication.
- Real eBay API integration.
- Database persistence.
- Production matching logic.
- Mobile push, email notifications, or external alerts.

## Success Criteria

- The app runs locally and shows a coherent first-pass dashboard.
- A user can switch between initial tabs.
- Candidate relisting cards show image, title, pricing, confidence, matching signals, ending time, and review actions.
- The UI gives enough fidelity to review look, feel, and workflow before backend work begins.

