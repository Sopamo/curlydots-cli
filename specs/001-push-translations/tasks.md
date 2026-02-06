# Tasks: Push Translations Command

**Input**: Design documents from `/specs/001-push-translations/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required by the project constitution. Include at least one unit/integration test per story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and test scaffolding

- [X] T001 Create fixture repo for push command tests in tests/fixtures/push-translations/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Define API payload types in src/types/translation-keys.ts (TranslationKeyPayload, ExistingKeysResponse)
- [X] T003 [P] Add translation keys API client in src/services/api/translation-keys.ts using HttpClient + token manager
- [X] T004 [P] Add push command argument schema + validation helpers in src/commands/translations/push-args.ts
- [X] T005 [P] Add output formatter for JSON + human summaries in src/ui/output.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Push new translation keys to backend (Priority: P1) 🎯 MVP

**Goal**: Upload missing translation keys with code context and source language values to the backend.

**Independent Test**: Execute the command against a fixture repo and mocked API; verify payload contains translationKey/sourceValue/sourceLanguage/codeContext for missing keys only.

### Tests for User Story 1 ✅

- [X] T006 [P] [US1] Contract test for translation-keys GET/POST payloads in tests/contract/translation-keys.test.ts
- [X] T007 [P] [US1] Integration test for successful push flow in tests/integration/push-translations.test.ts

### Implementation for User Story 1

- [X] T008 [US1] Add translations command router in src/commands/translations/index.ts
- [X] T009 [US1] Register `translations` command + help in src/index.ts
- [X] T010 [US1] Implement push command entry in src/commands/translations/push.ts (wire args, analyzer, context finder)
- [X] T011 [US1] Build analyzer payload mapping (exclude translation_context) in src/services/translation-keys/payload-builder.ts
- [X] T012 [US1] Emit JSON + human-readable summaries via src/ui/output.ts

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - Prevent duplicates with server reconciliation (Priority: P2)

**Goal**: Fetch existing backend keys and upload only the missing keys.

**Independent Test**: Mock backend existing keys list; verify only missing keys are sent in upload payload.

### Tests for User Story 2 ✅

- [X] T013 [P] [US2] Unit test for diff/filter logic in tests/unit/translation-keys-diff.test.ts
- [X] T014 [P] [US2] Integration test for skip-existing behavior in tests/integration/push-translations.test.ts

### Implementation for User Story 2

- [X] T015 [US2] Implement key diff logic in src/services/translation-keys/diff.ts
- [X] T016 [US2] Integrate diff into push flow in src/commands/translations/push.ts

**Checkpoint**: User Stories 1 and 2 independently functional

---

## Phase 5: User Story 3 - Handle connectivity and auth failures gracefully (Priority: P3)

**Goal**: Fail fast on auth issues, abort on first failed batch, and emit clear error messages + exit codes.

**Independent Test**: Simulate missing token, 401/400 responses, and failed batch; confirm non-zero exit codes and actionable errors.

### Tests for User Story 3 ✅

- [X] T017 [P] [US3] Unit test auth validation behavior in tests/unit/auth-validation.test.ts
- [X] T018 [P] [US3] Integration test for error handling/exit codes in tests/integration/push-translations-errors.test.ts

### Implementation for User Story 3

- [X] T019 [US3] Add auth validation using token manager before scanning in src/commands/translations/push.ts
- [X] T020 [US3] Enforce abort-on-first-failure batch behavior in src/services/api/translation-keys.ts
- [X] T021 [US3] Standardize error mapping and exit codes in src/commands/translations/push.ts

**Checkpoint**: All user stories functional and testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple stories

- [X] T022 [P] Update CLI help text and examples in src/index.ts
- [X] T023 [P] Update README usage docs in README.md to include `aitranslate translations push`
- [X] T024 Run quickstart validation steps in specs/001-push-translations/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on completion of desired user stories

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational
- **User Story 2 (P2)**: Starts after Foundational; builds on US1 payload flow
- **User Story 3 (P3)**: Starts after Foundational; hooks into US1/US2 flow

### Parallel Opportunities

- Foundational tasks T003–T005 can run in parallel
- Contract + integration tests per story can run in parallel
- US2 diff logic and US3 error handling can proceed after US1 structure is in place

---

## Parallel Example: User Story 1

```bash
# Run contract + integration tests in parallel:
Task: "Contract test for translation-keys GET/POST payloads in tests/contract/translation-keys.test.ts"
Task: "Integration test for successful push flow in tests/integration/push-translations.test.ts"

# Implement router + payload builder in parallel:
Task: "Add translations command router in src/commands/translations/index.ts"
Task: "Build analyzer payload mapping in src/services/translation-keys/payload-builder.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate with integration tests + CLI run

### Incremental Delivery

1. Add User Story 1 → test independently
2. Add User Story 2 → test independently
3. Add User Story 3 → test independently
4. Finish polish tasks
