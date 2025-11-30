# Tasks: LLM Reasoning Trace Logs

**Input**: Design documents from `/specs/003-reasoning-trace-logs/`  
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/

**Tests**: Tests are MANDATORY per the project constitution. Every task/feature MUST have tests that pass before completion.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add types and basic infrastructure for trace logging

- [x] T001 [P] Add TraceConfig and ReasoningTrace types to src/types/index.ts
- [x] T002 [P] Add `traces` field to TranslateConfig in src/types/index.ts

---

## Phase 2: Foundational

**Purpose**: Core trace-writing service that MUST complete before user stories

**⚠️ CRITICAL**: User story work cannot begin until this phase is complete

- [x] T003 [P] Unit test for trace-writer service in tests/unit/services/trace-writer.test.ts
- [x] T004 Create trace-writer service in src/services/trace-writer.ts (sanitizeFilename, formatTrace, writeTrace)
- [x] T005 Add --traces flag parsing to src/commands/translate.ts (parseTranslateArgs)

**Checkpoint**: Trace writer ready, CLI flag recognized

---

## Phase 3: User Story 1 - Save Reasoning Traces (Priority: P1) 🎯 MVP

**Goal**: Save full reasoning traces to text files for each translated key when --traces is enabled

**Independent Test**: Run `aitranslate translate input.csv --traces --yes`. After completion, `reasoning-traces/` directory exists with one `.txt` file per translation key.

### Tests for User Story 1 (MANDATORY) ✅

- [x] T006 [P] [US1] Integration test for trace file creation in tests/integration/translate-traces.test.ts

### Implementation for User Story 1

- [x] T007 [US1] Modify OpenAI client to extract reasoning from response in src/services/openai/client.ts
- [x] T008 [US1] Add traceConfig to TranslateState in src/stores/translation-store.ts
- [x] T009 [US1] Initialize trace directory when --traces is passed in src/commands/translate.ts
- [x] T010 [US1] Call writeTrace after each translation completes in src/commands/translate.ts
- [x] T011 [US1] Handle trace write errors gracefully (warn and continue) in src/commands/translate.ts

**Checkpoint**: `aitranslate translate input.csv --traces` creates trace files for each key

---

## Phase 4: User Story 2 - Organize by Run Timestamp (Priority: P2)

**Goal**: Organize trace files into timestamped subdirectories for each translation run

**Independent Test**: Run translate twice with --traces. Two separate timestamped directories exist with their own trace files.

### Tests for User Story 2 (MANDATORY) ✅

- [x] T012 [P] [US2] Unit test for timestamp directory creation in tests/unit/services/trace-writer.test.ts

### Implementation for User Story 2

- [x] T013 [US2] Generate filesystem-safe ISO timestamp (YYYY-MM-DDTHH-MM-SS) in src/services/trace-writer.ts
- [x] T014 [US2] Create timestamped subdirectory in reasoning-traces/ in src/services/trace-writer.ts
- [x] T015 [US2] Store runTimestamp in TraceConfig for consistent directory across parallel translations

**Checkpoint**: Multiple runs create separate timestamped directories

---

## Phase 5: Update - Context in Traces + OpenAI Fix (2025-11-30)

**Purpose**: Add code/translation context to trace files, fix OpenAI reasoning extraction

**Trigger**: Spec update requiring context in trace files; bug fix for empty reasoning traces

### Bug Fix: OpenAI Reasoning Extraction

- [x] T016 [US1] Add `summary: 'auto'` to OpenAI reasoning config in src/services/openai/client.ts
- [x] T017 [US1] Fix reasoning extraction from `response.output[]` array in src/services/openai/client.ts

### New Feature: Context in Trace Files

- [x] T018 [P] Add codeContext and translationContext fields to ReasoningTrace in src/types/index.ts
- [x] T019 Update formatTrace() to include context sections in src/services/trace-writer.ts
- [x] T020 Add formatContextForTrace() helper in src/commands/translate.ts
- [x] T021 Pass context to ReasoningTrace when writing traces in src/commands/translate.ts
- [x] T022 [P] Update unit tests for new trace format in tests/unit/services/trace-writer.test.ts

**Checkpoint**: Trace files now include code context, translation context, and actual LLM reasoning

---

## Phase 6: Update - Cost Tracking in Traces (2025-11-30 #2)

**Purpose**: Add LLM call cost (token usage) to trace files for cost tracking and optimization

**Trigger**: Spec update requiring cost information in trace files (FR-011)

### Types & Infrastructure

- [x] T028 [P] Add TokenUsage interface to src/types/index.ts
- [x] T029 Add tokenUsage field to ReasoningTrace interface in src/types/index.ts
- [x] T030 [P] Add calculateCost() function to src/services/trace-writer.ts

### OpenAI Client Updates

- [x] T031 Update TranslationResponseWithReasoning to include usage in src/services/openai/client.ts
- [x] T032 Extract response.usage from OpenAI response in translateText() in src/services/openai/client.ts

### Trace File Updates

- [x] T033 Update formatTrace() to include Cost section in src/services/trace-writer.ts
- [x] T034 Pass tokenUsage to ReasoningTrace when writing traces in src/commands/translate.ts

### Tests

- [x] T035 [P] Update unit tests for calculateCost() in tests/unit/services/trace-writer.test.ts
- [x] T036 [P] Update unit tests for new trace format with Cost section in tests/unit/services/trace-writer.test.ts

**Checkpoint**: Trace files now include token usage and estimated USD cost

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, validation, documentation

- [x] T023 [P] Run `bun run typecheck` and fix any type errors (previous)
- [x] T024 [P] Run `bun run lint` and fix any lint errors (previous)
- [x] T025 [P] Run `bun test` and ensure all tests pass (previous)
- [x] T026 Update quickstart.md with new trace file format (previous)
- [x] T027 Update data-model.md with codeContext and translationContext fields (previous)

### New Polish Tasks (Post Cost Tracking)

- [x] T037 [P] Run `bun run typecheck` and fix any type errors
- [x] T038 [P] Run `bun run lint` and fix any lint errors
- [x] T039 [P] Run `bun test` and ensure all tests pass
- [x] T040 Update quickstart.md with Cost section in trace format
- [x] T041 Verify data-model.md includes TokenUsage interface

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS user stories)
    ↓
    ├──> Phase 3: US1 (P1) - MVP
    │         ↓
    └──> Phase 4: US2 (P2) - depends on US1 trace infrastructure
              ↓
         Phase 5: Update (context + OpenAI fix) ✅
              ↓
         Phase 6: Update (cost tracking) ✅
              ↓
         Phase 7: Polish ✅
```

### User Story Dependencies

| Story | Can Start After | Dependencies |
|-------|-----------------|--------------|
| US1 (P1) | Phase 2 complete | None - core MVP |
| US2 (P2) | US1 complete | Uses trace directory structure from US1 |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (per constitution)
2. Core service before integration
3. Error handling after happy path
4. Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (all parallel):**
- T001 (types) || T002 (config types)

**Phase 2:**
- T003 (tests) can run in parallel with other prep
- T004 (service) and T005 (CLI flag) can be done in parallel

**Phase 3 - US1:**
- T006 (integration test) || T007 (client modification)

---

## Parallel Example: Setup + Foundational

```bash
# Phase 1 - All parallel:
T001: Add TraceConfig and ReasoningTrace types
T002: Add traces field to TranslateConfig

# Phase 2 - Tests first, then implementation:
T003: Unit test for trace-writer service
# Then:
T004: Create trace-writer service
T005: Add --traces flag parsing
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 (T006-T011)
4. **STOP and VALIDATE**: `aitranslate translate input.csv --traces` creates trace files
5. MVP complete! Users can now debug AI translation reasoning.

### Incremental Delivery

1. **Setup + Foundational** → Trace infrastructure ready
2. **Add US1** → Core trace logging works → **MVP Complete!**
3. **Add US2** → Timestamped organization added
4. **Polish** → Tests green, docs updated

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 41 |
| **Phase 1 (Setup)** | 2 ✅ |
| **Phase 2 (Foundational)** | 3 ✅ |
| **Phase 3 (US1 - MVP)** | 6 ✅ |
| **Phase 4 (US2)** | 4 ✅ |
| **Phase 5 (Context + OpenAI fix)** | 7 ✅ |
| **Phase 6 (Cost tracking)** | 9 ✅ |
| **Phase 7 (Polish)** | 10 ✅ |
| **Parallel Opportunities** | 14 tasks marked [P] |

### MVP Scope ✅ COMPLETE

Complete Phases 1-3 (11 tasks) for a functional MVP that:
- Adds `--traces` flag to translate command
- Extracts reasoning from OpenAI response
- Writes trace files with metadata header
- Handles errors gracefully (warn, don't fail)

### Update Scope (Phase 5) ✅ COMPLETE

The 2025-11-30 update #1 adds:
- **Bug fix**: OpenAI reasoning extraction now works (added `summary: 'auto'`, fixed extraction path)
- **New feature**: Trace files include code context and translation context for complete debugging

### Update Scope (Phase 6) ✅ COMPLETE

The 2025-11-30 update #2 adds:
- **New feature**: Trace files include LLM call cost (token usage and USD estimate)
- Token breakdown: input tokens, output tokens, reasoning tokens, total
- Cost calculation based on GPT-5.1 pricing ($2/1M input, $8/1M output)
