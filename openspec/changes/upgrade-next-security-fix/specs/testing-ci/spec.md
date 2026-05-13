# Capability: Testing And CI

## ADDED Requirements

### Requirement: Security dependency remediation

The project SHALL remediate high-severity production dependency advisories in focused dependency update changes.

#### Scenario: Production audit reports high-severity framework advisory

- **GIVEN** `npm audit --omit=dev` reports a high-severity advisory for a production framework dependency
- **WHEN** a patched compatible release is available
- **THEN** the dependency SHALL be upgraded in a focused branch
- **AND** the branch SHALL verify audit, unit tests, type checking, and OpenSpec validation before merge
