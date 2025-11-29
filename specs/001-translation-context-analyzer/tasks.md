# Tasks: Translation Context Analyzer

**Input**: Design documents from `/specs/001-translation-context-analyzer/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/cli.md ✅, research.md ✅

**Tests**: Tests are MANDATORY per project constitution (Test-First Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

**Updated**: 2025-11-29 - Added User Story 5 (TUI Progress Display) tasks with checklist and progress bars

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Bun project with `bun init` in repository root
- [x] T002 Create package.json with dependencies: ink, zustand, react, @types/react
- [x] T003 [P] Create tsconfig.json with strict mode enabled
- [x] T004 [P] Create biome.json for linting and formatting
- [x] T005 Create project directory structure per plan.md
- [x] T006 [P] Create .gitignore for node_modules, dist, coverage

**Checkpoint**: Project skeleton ready, `bun install` succeeds

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [x] T007 [P] Create test for config store in tests/unit/stores/config.test.ts
- [x] T008 [P] Create test for analysis store in tests/unit/stores/analysis.test.ts
- [x] T009 [P] Create test for parser registry in tests/unit/parsers/index.test.ts

### Implementation for Foundational

- [x] T010 Create shared type definitions in src/types/index.ts
- [x] T011 [P] Implement config store in src/stores/config.ts
- [x] T012 [P] Implement analysis store in src/stores/analysis.ts
- [x] T013 Implement store index with exports in src/stores/index.ts
- [x] T014 Create parser interface and registry in src/parsers/index.ts
- [x] T015 [P] Create test fixtures directory structure in tests/fixtures/sample-repo/
- [x] T016 [P] Create sample translation files for testing in tests/fixtures/sample-repo/translations/

**Checkpoint**: Foundation ready - `bun test` passes for stores and parser registry

---

## Phase 3: User Story 1 - Find Missing Translations (Priority: P1) 🎯 MVP

**Goal**: Identify translation keys in source language missing from target language

**Independent Test**: Run CLI with repo path, source=en, target=de. Output lists missing keys.

### Tests for User Story 1 (MANDATORY) ✅

- [x] T017 [P] [US1] Create test for node-module parser in tests/unit/parsers/node-module.test.ts
- [x] T018 [P] [US1] Create test for analyzer service in tests/unit/services/analyzer.test.ts
- [ ] T019 [US1] Create integration test for US1 flow in tests/integration/find-missing.test.ts

### Implementation for User Story 1

- [x] T020 [US1] Implement node-module parser in src/parsers/node-module.ts
- [x] T021 [US1] Register node-module parser in src/parsers/index.ts
- [x] T022 [US1] Implement analyzer service (compare keys) in src/services/analyzer.ts
- [x] T023 [US1] Create basic CLI entry point in src/index.ts (parse args, call analyzer)
- [x] T024 [US1] Implement CLI argument parsing with validation in src/index.ts
- [x] T025 [US1] Add error handling for invalid paths and missing dirs in src/index.ts

**Checkpoint**: `bun run src/index.ts ./test-repo -s en -t de -d translations` outputs missing keys

---

## Phase 4: User Story 2 - Collect Usage Context (Priority: P2)

**Goal**: For each missing key, find code usages and extract ±15 lines of context

**Independent Test**: Missing keys include context snippets showing where they're used in code.

### Tests for User Story 2 (MANDATORY) ✅

- [x] T026 [P] [US2] Create test for context-finder service in tests/unit/services/context-finder.test.ts
- [ ] T027 [US2] Create integration test for context collection in tests/integration/context-collection.test.ts

### Implementation for User Story 2

- [x] T028 [US2] Implement file search by extensions in src/services/context-finder.ts
- [x] T029 [US2] Implement key search (quoted and unquoted) in src/services/context-finder.ts
- [x] T030 [US2] Implement context extraction (±15 lines) in src/services/context-finder.ts
- [x] T031 [US2] Implement 10-snippet limit per key in src/services/context-finder.ts
- [x] T032 [US2] Integrate context-finder with analyzer in src/services/analyzer.ts
- [x] T033 [US2] Update analysis store with progress during context search in src/services/context-finder.ts

**Checkpoint**: Missing translations include context arrays with code snippets

---

## Phase 4.5: User Story 4 - Translation Context Examples (Priority: P2)

**Goal**: For each missing key, find how nouns in source value were previously translated

**Independent Test**: Missing keys include translation_context with examples of noun translations from existing translations.

**Requirements Covered**: FR-015, FR-016, FR-017, FR-018, FR-019

### Tests for User Story 4 (MANDATORY)

- [x] T053 [P] [US4] Create test for translation-context service in tests/unit/services/translation-context.test.ts
- [ ] T054 [US4] Create integration test for translation context in tests/integration/translation-context.test.ts

### Implementation for User Story 4

- [x] T055 [US4] Add TranslationContextExample type to src/types/index.ts
- [x] T056 [US4] Initialize wink-nlp with English model in src/services/translation-context.ts
- [x] T057 [US4] Implement extractNouns() using wink-nlp POS tagging in src/services/translation-context.ts
- [x] T058 [US4] Implement findTranslationExamples() with noun matching in src/services/translation-context.ts
- [x] T059 [US4] Implement prioritization logic (one per noun first) in src/services/translation-context.ts
- [x] T060 [US4] Implement 10-example limit in src/services/translation-context.ts
- [x] T061 [US4] Integrate translation-context service with analyzer in src/services/analyzer.ts
- [x] T062 [US4] Update MissingTranslation type to include translationContexts in src/types/index.ts

**Checkpoint**: `bun run src/index.ts` outputs translation_context with noun examples

---

## Phase 5: User Story 3 - CSV Export (Priority: P3)

**Goal**: Export results to properly formatted CSV file

**Independent Test**: Output CSV opens in Excel/Sheets with correct columns and escaped content.

### Tests for User Story 3 (MANDATORY) ✅

- [x] T034 [P] [US3] Create test for csv-writer service in tests/unit/services/csv-writer.test.ts
- [ ] T035 [US3] Create integration test for full CLI flow in tests/integration/cli.test.ts

### Implementation for User Story 3

- [x] T036 [US3] Implement CSV row formatting in src/services/csv-writer.ts
- [x] T037 [US3] Implement CSV special character escaping in src/services/csv-writer.ts
- [x] T038 [US3] Implement file writing with --output support in src/services/csv-writer.ts
- [x] T039 [US3] Integrate csv-writer into main CLI flow in src/index.ts
- [x] T040 [US3] Add success message with output path to CLI in src/index.ts
- [x] T063 [US3] Update CSV header to new format: translation_key,source_value,source_language,target_language,code_context,translation_context in src/services/csv-writer.ts
- [x] T064 [US3] Update formatCsvRow to include source_value and translation_context columns in src/services/csv-writer.ts

**Checkpoint**: Full CLI flow works end-to-end, CSV file has all 6 columns

---

## Phase 6: User Story 5 - TUI Progress Display (Priority: P3)

**Goal**: Display always-on TUI with config summary, task checklist, and progress bars for long-running tasks

**Independent Test**: Run CLI. Terminal shows config summary, 6-task checklist with checkmarks as tasks complete, and progress bars for code/translation context tasks.

**Requirements Covered**: FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028

### Tests for User Story 5 (MANDATORY)

- [x] T041 [P] [US5] Create test for progress view in tests/unit/ui/views/progress.test.tsx
- [x] T065 [P] [US5] Create test for TaskId and TaskState types in tests/unit/types/task.test.ts
- [x] T066 [P] [US5] Create test for task actions (startTask, completeTask, setTaskProgress) in tests/unit/stores/analysis.test.ts
- [x] T067 [US5] Create test for checklist view component in tests/unit/ui/views/checklist.test.tsx

### Implementation for User Story 5

#### Types & Store Updates

- [x] T068 [US5] Add TaskId union type to src/types/index.ts
- [x] T069 [US5] Add TaskState interface to src/types/index.ts
- [x] T070 [US5] Add DEFAULT_TASKS constant to src/stores/analysis.ts
- [x] T071 [US5] Add tasks array to AnalysisState in src/stores/analysis.ts
- [x] T072 [US5] Add activeTaskId field to AnalysisState in src/stores/analysis.ts
- [x] T073 [US5] Implement startTask(taskId) action in src/stores/analysis.ts
- [x] T074 [US5] Implement completeTask(taskId) action in src/stores/analysis.ts
- [x] T075 [US5] Implement setTaskProgress(taskId, processed, total) action in src/stores/analysis.ts
- [x] T076 [US5] Update reset() to initialize tasks to DEFAULT_TASKS in src/stores/analysis.ts

#### UI Components

- [x] T042 [US5] Create view exports in src/ui/views/index.ts
- [x] T043 [US5] Implement progress view component in src/ui/views/progress.tsx
- [x] T077 [US5] Implement ChecklistView component with task markers in src/ui/views/checklist.tsx
- [x] T078 [US5] Add checkmark (✓) rendering for completed tasks in src/ui/views/checklist.tsx
- [x] T079 [US5] Add in-progress indicator (spinner) for active task in src/ui/views/checklist.tsx
- [x] T080 [US5] Implement ProgressBarView for tasks with progress in src/ui/views/progress-bar.tsx
- [x] T081 [US5] Implement ConfigSummaryView component in src/ui/views/config-summary.tsx
- [x] T082 [US5] Export new views from src/ui/views/index.ts

#### App Integration

- [x] T044 [US5] Implement Ink app root in src/ui/app.tsx
- [x] T083 [US5] Update App to render ConfigSummaryView at top in src/ui/app.tsx
- [x] T084 [US5] Update App to render ChecklistView in src/ui/app.tsx
- [x] T085 [US5] Update App to render ProgressBarView below checklist for active long-running tasks in src/ui/app.tsx
- [x] T086 [US5] Add completion summary display when status='complete' in src/ui/app.tsx

#### CLI Integration

- [x] T045 [US5] Integrate TUI with analysis store for live updates in src/ui/app.tsx
- [x] T046 [US5] Connect TUI to main CLI entry point in src/index.ts
- [x] T087 [US5] Update runAnalysis to call startTask before each analysis phase in src/index.ts
- [x] T088 [US5] Update runAnalysis to call completeTask after each analysis phase in src/index.ts
- [x] T089 [US5] Update findContextForKeys to call setTaskProgress in src/services/context-finder.ts
- [x] T090 [US5] Update findTranslationContextForKeys to call setTaskProgress in src/services/translation-context.ts

**Checkpoint**: CLI shows config summary, 6-task checklist with checkmarks, progress bars for tasks 4 & 5

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T047 [P] Implement --help output per CLI contract in src/index.ts
- [x] T048 [P] Implement --version flag in src/index.ts
- [x] T050 [P] Create README.md with installation and usage instructions
- [x] T051 Run full test suite and fix any failures
- [ ] T052 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
Phase 3: US1 - Find Missing Translations (MVP)
    ↓
Phase 4: US2 - Collect Code Context
    ↓
Phase 4.5: US4 - Translation Context Examples
    ↓
Phase 5: US3 - CSV Export (with all 6 columns)
    ↓
Phase 6: US5 - TUI Progress Display (checklist + progress bars) ← CURRENT
    ↓
Phase 7: Polish
```

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only - can complete as MVP
- **US2 (P2)**: Depends on US1 (needs missing keys to search for)
- **US4 (P2)**: Depends on US1 (needs source values and existing translations)
- **US3 (P3)**: Depends on US1 + US2 + US4 (needs full data to export)
- **US5 (P3)**: Depends on all previous (needs full workflow to display progress)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (NON-NEGOTIABLE)
- Types → Stores → Services → CLI integration
- `bun test` must pass before moving to next story

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
T007, T008, T009 - All tests in parallel
T011, T012 - Config and analysis stores in parallel
T015, T016 - Fixtures in parallel
```

**Phase 3 (US1)**:
```
T017, T018 - Parser and analyzer tests in parallel
```

**Phase 4 (US2)**:
```
T026 - Context-finder test (standalone)
```

**Phase 4.5 (US4)**:
```
T053 - Translation-context test (standalone, can parallel with T054)
T055, T056 - Type and init (parallel)
```

**Phase 6 (US5 - TUI Progress)**:
```
T065, T066, T067 - All tests in parallel (different test files)
T068, T069 - Types in parallel
T077, T080, T081 - UI components in parallel (different files)
```

**Phase 7 (Polish)**:
```
T047, T048, T049, T050 - All in parallel (different files)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Tool identifies missing translations
5. Can demo/use with manual output formatting

### Incremental Delivery

1. Setup + Foundational → Foundation ready ✅
2. Add US1 → Identifies missing keys (MVP!) ✅
3. Add US2 → Keys have code context ✅
4. Add US4 → Keys have translation context examples ✅
5. Add US3 → Full CSV export with all 6 columns ✅
6. Add US5 → TUI with checklist + progress bars ✅
7. Polish → Production ready ← CURRENT

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story (US1, US2, US3, US4, US5)
- Per constitution: Tests FIRST, then implementation
- Per constitution: `bun test` must pass before task completion
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
