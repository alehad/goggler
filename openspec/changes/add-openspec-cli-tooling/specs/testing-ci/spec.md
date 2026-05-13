# Capability: Testing And CI

## MODIFIED Requirements

### Requirement: OpenSpec validation tooling

The repository SHALL provide a project-local command for strict OpenSpec validation.

#### Scenario: Developer validates OpenSpec changes locally

- **GIVEN** dependencies have been installed
- **WHEN** a developer runs `npm run openspec:validate`
- **THEN** the command SHALL validate all OpenSpec changes and specs in strict non-interactive mode
- **AND** it SHALL NOT require a globally installed OpenSpec CLI
