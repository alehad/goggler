## ADDED Requirements

### Requirement: The app can be built and run as a portable Docker container

The system SHALL provide a Docker image build that packages the app to run standalone, configured entirely via environment variables supplied at container start, with no secrets baked into the image itself, runnable on-demand on any machine without requiring it to stay running continuously.

#### Scenario: Building the image

- **GIVEN** the repository's `Dockerfile`
- **WHEN** `docker build` is run
- **THEN** it SHALL produce a runnable image using Next.js's standalone output, without requiring a full `npm install` in the final image layer

#### Scenario: No secrets in the image

- **GIVEN** the built image
- **WHEN** its layers are inspected
- **THEN** no `.env` file or credential value SHALL be present in any layer
- **AND** all configuration SHALL be supplied via environment variables at container start, not baked in at build time

#### Scenario: Runtime configuration reuses existing environment variables

- **GIVEN** the container is started with the same environment variable names already used for local development (database target, tunnel target, eBay credentials, auth secret)
- **WHEN** the app starts
- **THEN** it SHALL behave identically to running those same values via `next dev` locally, with no separate deployment-specific configuration mechanism

#### Scenario: The same image runs on more than one machine

- **GIVEN** the built image
- **WHEN** it is run on two different machines (verified: this Mac and the user's iMac) with each machine's own appropriate environment values
- **THEN** it SHALL behave identically on both, proving the packaging itself is portable rather than tied to one machine's local setup

### Requirement: A running container is reachable via the same Tailscale access-control model as local development

Whenever the container is running, it SHALL be reachable through the same two-port Tailscale Serve/Funnel topology already established for local development — tailnet-only for the app itself, with only the eBay OAuth callback path publicly reachable on a separate port.

#### Scenario: Primary app access is tailnet-only

- **GIVEN** the container is running and the host's Tailscale client is configured per the documented steps
- **WHEN** a tailnet member requests the primary app URL
- **THEN** it SHALL be served
- **AND** a non-tailnet-member request to that same primary URL SHALL NOT be served

#### Scenario: Only the eBay callback path is publicly reachable

- **GIVEN** the same host configuration
- **WHEN** an anonymous request arrives at the funneled callback port's callback path
- **THEN** it SHALL reach the app
- **AND** any other path on that funneled port SHALL NOT be reachable

### Requirement: A container restart does not persist eBay OAuth session state, by design

The system SHALL continue to hold eBay OAuth session material only in server memory, consistent with the project's existing invariant against persisting eBay OAuth credentials, whether run via `next dev` or as a container.

#### Scenario: Restart requires re-authentication

- **GIVEN** a user has an active eBay-authenticated session against a running container
- **WHEN** the container stops and a new one starts (including on a different machine)
- **THEN** that session SHALL be gone
- **AND** the user SHALL need to authenticate with eBay again via browser before any eBay-dependent action works

### Requirement: Docker Hub publishing is tag-triggered, not automatic on merge

The system SHALL publish a versioned image to Docker Hub only when a version tag is explicitly pushed, never automatically on an ordinary merge to the main branch.

#### Scenario: Ordinary merge does not publish

- **GIVEN** a pull request is merged to `main` under the existing autonomous ship workflow
- **WHEN** no version tag is pushed as part of that merge
- **THEN** no Docker Hub publish SHALL occur

#### Scenario: Pushing a version tag triggers publishing

- **GIVEN** a tag matching `v*` is pushed
- **WHEN** the GitHub Actions workflow runs
- **THEN** it SHALL build the image and push it to the configured Docker Hub repository, tagged with both the pushed tag name and `latest`

#### Scenario: The version decision is asked, not assumed

- **GIVEN** a pull request has just been merged under the autonomous ship workflow
- **WHEN** the merge completes
- **THEN** the system SHALL ask the user whether this change warrants a new Docker Hub version
- **AND** SHALL only create and push a version tag if the user says yes

#### Scenario: No secret material is ever exposed

- **GIVEN** the publishing workflow's configuration and run logs
- **WHEN** they are inspected
- **THEN** the Docker Hub credential value SHALL never appear in the repository, in workflow logs, or in this project's conversation history — only referenced via a GitHub Actions secret the user configured directly
