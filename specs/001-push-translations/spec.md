# Feature Specification: CLI Translation Push

**Feature Branch**: `[001-push-translations]`  
**Created**: 2026-02-06  
**Status**: Draft  
**Input**: User description: "We want to have a new cli command that extracts the translation keys for the given project with the configured default language and collects code context and the default language’s current value. This data should then be sent to the backend. We already have a very similar command “src/commands/extract.ts” that collects the same data and writes it to a csv file. We don’t need the extract command anymore, but can basically rewrite to be our new pushTranslations command. The data that we do not need to collect is “translation_context”, as that will be handled in the backend in the future. So the data we want to upload is: - translationKey - sourceValue - sourceLanguage - codeContext We only want to upload new translationKeys though, so before we upload them, we have to fetch the current keys for this project from the api and then only upload the ones that are missing. Projects in the api are identified by a uuid."

## Clarifications

### Session 2026-02-06

- Q: What should the CLI do when an upload batch fails? → A: Retry failed HTTP requests up to the configured retry count (default 3), then fail the command if a batch still cannot be uploaded.
- Q: What default upload batch size should be used? → A: 100 keys per batch.
- Q: When should authentication be validated? → A: Validate auth before scanning the repo.
- Q: What default API host should be used? → A: https://curlydots.com.
- Q: Which extensions should be scanned by default? → A: Scan all supported extensions by default.
- Q: Should the CLI fetch existing keys before upload? → A: Yes, the backend returns all existing keys and the CLI uploads only new keys.

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

### User Story 1 - Push new translation keys (Priority: P1)

As a developer, I want to run a CLI command that scans my project and uploads only new translation keys with the default language values so that the backend stores missing keys without duplicates.

**Why this priority**: This is the core value: pushing missing keys to the backend for a project.

**Independent Test**: Execute the command against a fixture repo and mock backend; verify the payload includes translationKey, sourceValue, sourceLanguage, and codeContext for every missing key, and the backend receives them.

**Acceptance Scenarios**:

1. **Given** a project with translation keys, **When** I run the push command, **Then** the CLI fetches existing keys and uploads only new ones.
2. **Given** a project with no new translation keys, **When** I run the push command, **Then** no upload occurs and the CLI reports that nothing new was found.

---

### User Story 2 - Use existing extraction behavior (Priority: P2)

As a developer, I want the new command to reuse the existing extraction logic so that extracted keys, source values, and code context stay consistent with current behavior.

**Why this priority**: Maintaining consistent extraction output avoids regressions and keeps data reliable.

**Independent Test**: Can be tested by comparing the extraction output between the old CSV extraction and the new push command.

**Acceptance Scenarios**:

1. **Given** a project that previously produced a CSV extract, **When** I run the push command, **Then** the extracted translationKey, sourceValue, sourceLanguage, and codeContext match the prior extract data (excluding translation_context).

---

### User Story 3 - Report missing configuration (Priority: P3)

As a developer, I want clear CLI feedback when the project UUID context or source language argument is missing so that I can fix configuration quickly.

**Why this priority**: Helpful feedback improves usability but does not block the core upload flow when configuration is correct.

**Independent Test**: Can be tested by running the command without required config and verifying the error message.

**Acceptance Scenarios**:

1. **Given** a project without a selected or provided UUID, or missing `--source`, **When** I run the push command, **Then** the CLI exits with a clear error describing the missing configuration.

---

### Edge Cases

- Project UUID does not exist in the backend or is unauthorized.
- Backend returns the full list of existing keys for the project.
- Extraction finds duplicate translation keys in the codebase.
- Network/API errors during fetch or upload (timeouts, 5xx responses).
- Source language is missing from command arguments.
- Source value is empty or missing for extracted keys.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The CLI MUST provide a `translations push` command that uploads translation keys to the backend.
- **FR-002**: The command MUST collect translationKey, sourceValue, sourceLanguage, and codeContext for each extracted entry.
- **FR-003**: The command MUST omit translation_context from the collected data.
- **FR-004**: The command MUST fetch the existing translation keys for the configured project UUID before uploading.
- **FR-005**: The command MUST upload only translationKey entries that are missing from the backend for the project.
- **FR-006**: The command MUST use the provided `--source` language as `sourceLanguage` for extraction.
- **FR-007**: The command MUST report when no new keys are found and skip the upload.
- **FR-008**: The command MUST surface clear errors when project UUID context or source language input is missing.
- **FR-009**: The command MUST retry transient API failures up to the configured retry count (default 3) and fail with a non-zero exit if upload still fails.
- **FR-010**: The command MUST default to 100 keys per upload batch.
- **FR-011**: The command MUST validate authentication before scanning the repo and fail fast if auth is missing.
- **FR-012**: The command MUST default the API host to https://curlydots.com when not explicitly provided.
- **FR-013**: The command MUST scan all supported extensions by default unless --extensions is provided.
- **FR-014**: The command MUST handle API failures with a non-zero exit and actionable error message.

### Key Entities *(include if feature involves data)*

- **Translation Key Entry**: A single extracted translation key plus sourceValue, sourceLanguage, and codeContext.
- **Project**: Backend project identified by UUID that owns translation keys.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: The command uploads 100% of translation keys that are missing in the backend for the project.
- **SC-002**: Running the command on a project with no new keys results in zero uploads and a clear no-op message.
- **SC-003**: The command reports configuration errors (missing project UUID context or source language) in under 5 seconds of execution.
- **SC-004**: The extracted data fields for uploaded keys include translationKey, sourceValue, sourceLanguage, and codeContext for every uploaded entry.
