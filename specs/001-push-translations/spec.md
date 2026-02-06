# Feature Specification: Push Translations Command

**Feature Branch**: `001-push-translations`  
**Created**: 2026-01-16  
**Status**: Draft  
**Input**: User description: "We want to have a new cli command that extracts the translation keys for the given project with the configured default language and collects code context and the default language’s current value. This data should then be sent to the backend. We only want to upload new translationKeys though, so before we upload them, we have to fetch the current keys for this project from the api and then only upload the ones that are missing. Projects in the api are identified by a uuid."

Create an `aitranslate translations push` CLI command that reuses the existing extract/analyzer capabilities to gather translation keys, code context, and default-language values, but instead of writing a CSV it uploads only the keys that are not yet known to the backend API for the specified project UUID.

## Clarifications

### Session 2026-01-16

- Q: Where should the optional API token be sourced from if not provided on the command line? → A: Use the existing CLI auth token store created by `aitranslate login`.
- Q: Should the CLI continue or stop when a batch upload fails mid-run? → A: Abort immediately on the first failed batch.
- Q: Should we define a default batch size for uploads? → A: Yes, default to 100 keys per batch.
- Q: Should auth be validated before scanning the repo? → A: Yes, fail fast before scanning if auth is missing.
- Q: Should extensions be configurable? → A: Yes, default to all supported extensions; if `--extensions` is provided, only those are scanned.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Push new translation keys to backend (Priority: P1)

As a developer managing translations, I want to run `aitranslate translations push --project <uuid> --repo <path> --translations-dir <path> --source <lang> --parser <name> [--api-host <url>] [--api-token <token>]` so that every new translation key with its code context and default-language value is uploaded to the backend without manual CSV handling.

**Why this priority**: This replaces the current CSV workflow and is the only way to seed the backend with new keys, so it directly unblocks the translation pipeline.

**Independent Test**: Execute the command against a fixture repo and mock backend; verify the payload includes translationKey, sourceValue, sourceLanguage, and codeContext for every missing key, and the backend receives them.

**Acceptance Scenarios**:

1. **Given** a repo path, translations directory, and default language supplied as command arguments, **When** the developer runs `aitranslate translations push --project <uuid> ...`, **Then** the CLI analyzes the source files, collects key metadata, and uploads it to the backend endpoint.
2. **Given** keys that already exist on the backend, **When** the command runs, **Then** those keys are excluded from the upload payload and reported as already-synced.
3. **Given** a successful upload, **When** the command completes, **Then** the user sees a summary of keys scanned, skipped, and sent, without needing to open CSV files.

---

### User Story 2 - Prevent duplicates with server reconciliation (Priority: P2)

As a localization engineer, I only want genuinely missing keys uploaded, so the CLI must fetch the project’s existing keys from the backend (via project UUID) before sending anything.

**Why this priority**: Duplicate uploads cause noisy review queues and potential conflicts; server reconciliation ensures only net-new work is created.

**Independent Test**: Mock the backend to return a list of existing keys; verify the CLI diff logic filters them out and only POSTs the delta.

**Acceptance Scenarios**:

1. **Given** the backend lists 5 existing keys and the analyzer finds 8 keys locally, **When** the command prepares payloads, **Then** only the 3 missing keys are included in the upload request.
2. **Given** the backend returns all existing keys for the project UUID in a single response, **When** the CLI fetches existing keys, **Then** it uses that full set to diff before uploading.

---

### User Story 3 - Handle connectivity and auth failures gracefully (Priority: P3)

As a developer working from CI or local machines, I need the command to report meaningful errors (auth token missing, network timeouts, validation failures) so I can retry or fix configuration quickly.

**Why this priority**: Reliable error feedback prevents silent failures that would otherwise block localization schedules.

**Independent Test**: Simulate API 401, 409, and network timeout responses; confirm the CLI exits with non-zero status, prints actionable guidance, and never corrupts local data.

**Acceptance Scenarios**:

1. **Given** the API returns 401 because the CLI token is absent, **When** the command runs, **Then** it aborts before scanning finishes, explains how to authenticate, and exits with failure.
2. **Given** the network request fails or partially succeeds, **When** retries are exhausted, **Then** the command surfaces which keys were successfully uploaded vs pending, enabling re-run without duplication.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when the backend already knows every key? → Command should short-circuit upload, print "0 new keys" summary, and still exit successfully.
- How does the system handle missing configuration (repo path, default language, project UUID, API token)? → Validate before scanning; show aggregated configuration errors.
- How are extremely large projects handled? → Command should stream/paginate fetches, batch uploads, and display progress to avoid timeouts.
- What happens if the backend diff endpoint throttles or rate-limits? → Exponential backoff with clear messaging and resume support.
- How does the CLI behave if code context search yields >10 snippets? → Respect existing cap (e.g., max 10 contexts) and mention truncation in payload to keep requests bounded.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: CLI MUST provide an `aitranslate translations push` command that accepts project UUID, repo path, translations directory, parser, and default/source language as required arguments, plus optional API host, API token, and extensions arguments.
- **FR-002**: CLI MUST default the API host to `https://curlydots.com` when `--api-host` is not provided.
- **FR-003**: CLI MUST accept API tokens from either the `--api-token` argument or the existing CLI auth token store created by `aitranslate login`; if neither is present, the command must fail with an actionable error.
- **FR-004**: CLI MUST validate API authentication before scanning the repo; missing auth must fail fast with actionable guidance.
- **FR-005**: CLI MUST reuse the analyzer to enumerate all translation keys and default-language values and locate up to 10 code context snippets per key without collecting translation_context data, scanning all supported extensions by default.
- **FR-006**: When `--extensions` is provided, CLI MUST restrict code context searches to only those extensions.
- **FR-007**: CLI MUST call the backend to fetch the complete set of existing translation keys for the project UUID in a single response before uploading.
- **FR-008**: CLI MUST diff local keys against backend keys client-side and build an upload payload that only includes unseen translation keys.
- **FR-009**: For every new key, CLI MUST send translationKey, sourceValue, sourceLanguage, and serialized codeContext array to the backend using the configured API authentication.
- **FR-010**: CLI MUST batch upload requests (default 100 keys per batch, configurable) and abort immediately on the first failed batch while displaying progress + summary (scanned, skipped, uploaded, failed) to stdout/TUI.
- **FR-011**: CLI MUST provide deterministic exit codes: success (0) when upload completes, non-zero with error messaging for validation failures, auth issues, or network errors.
- **FR-012**: CLI MUST log or surface backend validation errors per key (e.g., payload rejected) so users can correct source data and retry without resending successful keys.

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **Project**: Identified by UUID, stores metadata (default language, existing translation keys) retrieved via backend API.
- **TranslationKeyPayload**: Data structure per key with `translationKey`, `sourceValue`, `sourceLanguage`, and `codeContext` array (truncated to limit) sent to backend.
- **API Session**: Authentication context holding API base URL, auth token, retry/backoff policy used for fetching and uploading keys.

## Assumptions & Dependencies

- Backend implementation lives in `./curlydots-admin` and will provide the required project key listing and upload endpoints.
- Backend API exposes authenticated endpoints to (a) list existing translation keys for a project UUID and (b) accept batched uploads of new keys using the specified payload fields.
- Users supply repo path, translations directory, parser, and default/source language as explicit command arguments for each run; API host defaults to `https://curlydots.com` and API token may come from `--api-token` or the existing CLI auth token store.
- Existing analyzer, context finder, and parser services remain accurate for supported frameworks; this feature does not introduce new parsing logic.
- Network connectivity to the backend is available from both developer machines and CI environments; retry/backoff handles transient failures but not prolonged outages.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: `aitranslate translations push` processes and uploads 1,000 new keys (including context extraction) in under 60 seconds on a typical repo (<5 MB JS/TS source).
- **SC-002**: 100% of uploads exclude keys already known to the backend (verified by comparing CLI diff summary vs backend counts in integration tests).
- **SC-003**: All error conditions (validation, auth, network) produce actionable messages within 5 seconds of occurrence and exit with non-zero status for automation friendliness.
- **SC-004**: At least 95% of successful pushes complete without manual retries across supported environments (local dev, CI) during beta rollout, measured via CLI telemetry or backend logs.
