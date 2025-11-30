# Tasks: CSV Translation with AI

**Input**: Design documents from `/specs/002-csv-translation/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are MANDATORY per the project constitution. Every task/feature MUST have tests that pass before completion.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add dependencies and extend type definitions

- [x] T001 Install new dependencies: `bun add openai p-limit fast-csv`
- [x] T002 [P] Add translation types to src/types/index.ts (TranslationRow, TranslationRequest, TranslationResponse, TranslateConfig, TranslateState)
- [x] T003 [P] Create JSON response schema in src/services/openai/schemas.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: CLI refactoring and CSV library migration that MUST complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Refactor src/index.ts to subcommand router pattern (detect `extract` vs `translate` subcommand)
- [x] T005 Create src/commands/extract.ts and move existing extraction logic from src/index.ts
- [x] T006 Refactor src/services/csv-writer.ts to use fast-csv instead of manual string escaping
- [x] T007 [P] Create src/services/csv-reader.ts using fast-csv parse API
- [x] T008 [P] Update tests/unit/services/csv-writer.test.ts for fast-csv refactor
- [x] T009 ~~Removed: No backward compatibility needed~~ (CLI requires explicit subcommand)

**Checkpoint**: CLI subcommands work, CSV read/write uses fast-csv, existing tests pass

---

## Phase 3: User Story 1 - Translate CSV with AI Context (Priority: P1) 🎯 MVP

**Goal**: Core translation functionality - read CSV, send to OpenAI with context, write output with translated_value column

**Independent Test**: Run `aitranslate translate test.csv` with a valid CSV. Output contains translated_value column with AI translations.

### Tests for User Story 1 (MANDATORY) ✅

- [x] T010 [P] [US1] Unit test for XML prompt builder in tests/unit/services/openai/prompts.test.ts
- [x] T011 [P] [US1] Unit test for OpenAI client wrapper in tests/unit/services/openai/client.test.ts
- [x] T012 [P] [US1] Unit test for CSV reader in tests/unit/services/csv-reader.test.ts
- [x] T013 [P] [US1] Integration test for translate flow in tests/integration/translate-flow.test.ts

### Implementation for User Story 1

- [x] T014 [P] [US1] Create OpenAI client wrapper in src/services/openai/client.ts (Responses API, GPT-5.1, reasoning_effort: low)
- [x] T015 [P] [US1] Create XML prompt builder in src/services/openai/prompts.ts (format context as XML per contracts/translation-prompt.xml)
- [x] T016 [US1] Create src/stores/translation-store.ts with Zustand (TranslateState from data-model.md)
- [x] T017 [US1] Create src/commands/translate.ts with CLI argument parsing (--output, --concurrency, --force, --yes)
- [x] T018 [US1] Implement core translation loop in src/commands/translate.ts (read CSV → translate rows → write output)
- [x] T019 [US1] Implement parallel processing with p-limit in src/commands/translate.ts (default concurrency: 5)
- [x] T020 [US1] Implement incremental CSV writing (write after each row completes, preserve row order)
- [x] T021 [US1] Add API key validation (check OPENAI_API_KEY before processing)
- [x] T022 [US1] Add code context warning and confirmation prompt (--yes to skip)

**Checkpoint**: `aitranslate translate input.csv` works end-to-end, outputs CSV with translated_value column

---

## Phase 4: User Story 2 - Progress Feedback (Priority: P2)

**Goal**: Real-time TUI showing translation progress (X/Y rows completed)

**Independent Test**: Run translate on 10+ row CSV. Terminal shows live progress updates.

### Tests for User Story 2 (MANDATORY) ✅

- [ ] T023 [P] [US2] Unit test for progress view in tests/unit/ui/translate-progress.test.tsx

### Implementation for User Story 2

- [ ] T024 [US2] Create src/ui/views/translate-progress.tsx with Ink (progress bar, row counter)
- [ ] T025 [US2] Integrate TUI rendering in src/commands/translate.ts
- [ ] T026 [US2] Add completion summary display (total translated, time elapsed)

**Checkpoint**: Progress bar and counter update in real-time during translation

---

## Phase 5: User Story 3 - Handle API Errors Gracefully (Priority: P2)

**Goal**: Robust error handling - continue on failure, retry rate limits, abort on consecutive failures

**Independent Test**: Mock API failure mid-translation. Tool logs error, continues with remaining rows.

### Tests for User Story 3 (MANDATORY) ✅

- [ ] T027 [P] [US3] Unit test for retry logic in tests/unit/services/openai/client.test.ts
- [ ] T028 [P] [US3] Integration test for error scenarios in tests/integration/translate-error-handling.test.ts

### Implementation for User Story 3

- [ ] T029 [US3] Add exponential backoff retry for 429 errors in src/services/openai/client.ts (delays: 1s, 2s, 4s with jitter)
- [ ] T030 [US3] Add error handling in translation loop: log failure, mark row as error, continue
- [ ] T031 [US3] Add consecutive error tracking in src/stores/translation-store.ts
- [ ] T032 [US3] Implement abort threshold (5 consecutive failures) with progress summary
- [ ] T033 [US3] Add error summary at completion (failed count, failed keys list)

**Checkpoint**: Translation continues after individual failures, aborts after 5 consecutive failures

---

## Phase 6: User Story 4 - Resume Incomplete Translations (Priority: P3)

**Goal**: Skip already-translated rows when re-running, re-attempt ERROR rows

**Independent Test**: Run translate, interrupt, re-run. Only empty rows are translated.

### Tests for User Story 4 (MANDATORY) ✅

- [ ] T034 [P] [US4] Unit test for resume detection in tests/unit/services/csv-reader.test.ts
- [ ] T035 [P] [US4] Integration test for resume flow in tests/integration/translate-resume.test.ts

### Implementation for User Story 4

- [ ] T036 [US4] Extend csv-reader.ts to detect existing translated_value column
- [ ] T037 [US4] Add skip logic in translate loop: skip rows with non-empty translated_value (unless --force)
- [ ] T038 [US4] Re-attempt rows marked as "ERROR" on resume
- [ ] T039 [US4] Update progress display to show "Skipped: X" count

**Checkpoint**: Resume works correctly, --force re-translates all rows

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, documentation, final validation

- [ ] T040 [P] Run `bun test` and ensure all tests pass
- [ ] T041 [P] Run `bun run typecheck` and fix any type errors
- [ ] T042 [P] Run `bun run lint` and fix any lint errors
- [ ] T043 Update README.md with translate command documentation
- [ ] T044 Run quickstart.md validation (manual test of documented commands)
- [ ] T045 Create test fixture CSV in tests/fixtures/translation-input.csv

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
    ├──> Phase 3: US1 (P1) - MVP
    │         ↓
    ├──> Phase 4: US2 (P2) - depends on US1 translate loop
    │         ↓
    ├──> Phase 5: US3 (P2) - depends on US1 translate loop
    │         ↓
    └──> Phase 6: US4 (P3) - depends on US1 csv-reader
              ↓
         Phase 7: Polish
```

### User Story Dependencies

| Story | Can Start After | Dependencies |
|-------|-----------------|--------------|
| US1 (P1) | Phase 2 complete | None - core MVP |
| US2 (P2) | US1 T018 (translate loop) | Needs translate loop to integrate TUI |
| US3 (P2) | US1 T014 (OpenAI client) | Adds retry/error to existing client |
| US4 (P3) | US1 T007 (csv-reader) | Extends csv-reader for resume detection |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (per constitution)
2. Models/Types before services
3. Services before commands
4. Core implementation before integration
5. Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (all parallel):**
- T002 (types) || T003 (schemas)

**Phase 2:**
- T007 (csv-reader) || T008 (csv-writer tests)

**Phase 3 - US1 Tests (all parallel):**
- T010 || T011 || T012 || T013

**Phase 3 - US1 Implementation:**
- T014 (client) || T015 (prompts)
- Then T016 → T017 → T018 → T019 → T020 → T021 → T022 (sequential)

**Phase 7 (all parallel):**
- T040 || T041 || T042

---

## Parallel Example: User Story 1

```bash
# Write tests first (parallel):
bun test tests/unit/services/openai/prompts.test.ts  # T010
bun test tests/unit/services/openai/client.test.ts   # T011
bun test tests/unit/services/csv-reader.test.ts      # T012
bun test tests/integration/translate-flow.test.ts    # T013

# Then implement OpenAI services (parallel):
# T014: src/services/openai/client.ts
# T015: src/services/openai/prompts.ts

# Then sequential implementation:
# T016 → T017 → T018 → T019 → T020 → T021 → T022
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009) - **CRITICAL GATE**
3. Complete Phase 3: User Story 1 (T010-T022)
4. **STOP and VALIDATE**: `aitranslate translate test.csv` works
5. Deploy/demo if ready - this is a functional MVP!

### Incremental Delivery

1. **Setup + Foundational** → CLI refactored, fast-csv working
2. **Add US1** → Core translation works → **MVP Complete!**
3. **Add US2** → Progress feedback added
4. **Add US3** → Error handling robust
5. **Add US4** → Resume capability added
6. **Polish** → Tests green, docs updated

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 45 |
| **Phase 1 (Setup)** | 3 |
| **Phase 2 (Foundational)** | 6 |
| **Phase 3 (US1 - MVP)** | 13 |
| **Phase 4 (US2)** | 4 |
| **Phase 5 (US3)** | 7 |
| **Phase 6 (US4)** | 6 |
| **Phase 7 (Polish)** | 6 |
| **Parallel Opportunities** | 18 tasks marked [P] |

### MVP Scope

Complete Phases 1-3 (22 tasks) for a functional MVP that:
- Translates CSV files with AI context
- Uses OpenAI GPT-5.1 with Responses API
- Writes output with translated_value column
- Supports parallel processing (5 concurrent)
- Includes confirmation prompt for data privacy
