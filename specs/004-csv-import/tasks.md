# Tasks: CSV Import Command

**Input**: Design documents from `/specs/004-csv-import/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Tests are MANDATORY per the project constitution (Principle III & IV). Tests must be written and FAIL before implementation.

**Organization**: Tasks grouped by phase. Single user story (P1), so all feature work is in Phase 3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- All paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: No additional setup required - existing project structure is sufficient

*No tasks - project infrastructure already exists*

---

## Phase 2: Foundational (Parser Interface Refactoring)

**Purpose**: Refactor Parser interface to support both export (read) and import (write) operations

**⚠️ CRITICAL**: Import command cannot be implemented until this phase is complete

### Tests for Foundational (MANDATORY) ✅

- [x] T001 [P] Update parser export tests to use new method name `export()` in `tests/unit/parsers/node-module.test.ts`
- [x] T002 [P] Write failing tests for `parser.import()` method in `tests/unit/parsers/node-module.test.ts`

### Implementation

- [x] T003 Add `ParserImportResult` type to `src/types/index.ts`
- [x] T004 Update `Parser` interface: rename `parse()` to `export()`, add `import()` method in `src/types/index.ts`
- [x] T005 Rename `parse()` to `export()` in `src/parsers/node-module.ts`
- [x] T006 Update `src/commands/extract.ts` to call `parser.export()` instead of `parser.parse()`
- [x] T007 Update `src/services/analyzer.ts` to call `parser.export()` instead of `parser.parse()`
- [x] T008 Implement `import()` method in `src/parsers/node-module.ts` (deep merge, file creation, CommonJS output)
- [x] T009 Verify all existing tests pass with `bun test`

**Checkpoint**: Parser interface refactored. Extract command still works. Ready for import command.

---

## Phase 3: User Story 1 - Import Translated CSV to File System (Priority: P1) 🎯 MVP

**Goal**: Developer can run `aitranslate import <csv-file> -d <translations-dir>` to write translated CSV data back to translation files.

**Independent Test**: Run import command on a translated CSV and verify target language files are updated with new translations.

### Tests for User Story 1 (MANDATORY) ✅

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T010 [P] [US1] Write failing unit tests for `import-service.ts` in `tests/unit/services/import-service.test.ts`
- [x] T011 [P] [US1] Write failing integration tests for import command in `tests/integration/import-command.test.ts`

### Implementation for User Story 1

- [x] T012 [P] [US1] Add `ImportRow`, `ImportResult`, `ImportError` types to `src/types/index.ts`
- [x] T013 [US1] Create `src/services/import-service.ts` with:
  - `runImport(csvPath, translationsDir, parser)` function
  - Read CSV using existing `csv-reader.ts`
  - Filter rows with empty `translated_value` (skip with warning)
  - Extract target language from first row (single language per CSV)
  - Build `Map<string, string>` of translation_key → translated_value
  - Call `parser.import(langDir, translations)` once
  - Return `ImportResult` summary
- [x] T014 [US1] Create `src/commands/import.ts` with:
  - `parseImportArgs(args)` function (handle `--parser`/`-p` argument, default: node-module)
  - `validateImportArgs(args)` function  
  - `printImportHelp()` function
  - `runImport(args)` function
  - Summary display (files modified, keys added/updated, skipped, errors)
- [x] T015 [US1] Register import command in `src/index.ts` switch statement
- [x] T016 [US1] Verify all tests pass with `bun test`

**Checkpoint**: Import command fully functional. Full workflow (extract → translate → import) works end-to-end.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final verification

- [x] T017 [P] Update README.md to change import command from "Coming Soon" to documented
- [x] T018 [P] Add edge case tests for malformed keys, missing directories in `tests/unit/parsers/node-module.test.ts`
- [x] T019 Run full workflow test: extract → translate → import → verify files
- [x] T020 Run `bun run typecheck` and `bun run lint` - fix any issues

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────┐
                                                     │
Phase 2 (Foundational) ◄─────────────────────────────┘
   │
   │ BLOCKS (Parser interface must be complete)
   ▼
Phase 3 (User Story 1 - MVP) ◄───────────────────────
   │
   │ Depends on US1 completion
   ▼
Phase 4 (Polish)
```

### Within Each Phase

1. **Tests FIRST** - Write tests, verify they FAIL
2. **Types** - Define data structures
3. **Core logic** - Services and parsers
4. **Command** - CLI interface
5. **Integration** - Wire everything together
6. **Verify** - All tests pass

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
T001 (update export tests) ─┬─► T003-T009 (implementation)
T002 (write import tests)  ─┘
```

**Phase 3 (User Story 1)**:
```
T010 (import-service tests) ─┬─► T012 (types) ─► T013 (service) ─► T014 (command) ─► T015-T016
T011 (integration tests)    ─┘
```

**Phase 4 (Polish)**:
```
T017 (README) ──────────────┬─► T019 (workflow test) ─► T020 (lint/typecheck)
T018 (edge case tests)     ─┘
```

---

## Implementation Strategy

### MVP Delivery (Recommended)

1. Complete Phase 2: Foundational (Parser refactoring)
2. Complete Phase 3: User Story 1 (Import command)
3. **STOP and VALIDATE**: Test full workflow
4. Complete Phase 4: Polish

### Task Execution Order (Single Developer)

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009
                                                          │
T010 → T011 ──────────────────────────────────────────────┤
                                                          ▼
       T012 → T013 → T014 → T015 → T016
                                    │
       T017 ─┬─────────────────────►│
       T018 ─┘                      ▼
                              T019 → T020
```

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 20 |
| **Phase 2 (Foundational)** | 9 tasks |
| **Phase 3 (User Story 1)** | 7 tasks |
| **Phase 4 (Polish)** | 4 tasks |
| **Parallel Opportunities** | 6 task pairs |
| **MVP Scope** | Phase 2 + Phase 3 (16 tasks) |

---

## Notes

- Constitution requires Test-First Development (Principle III)
- All tests must pass before task completion (Principle IV)
- Use `bun test`, `bun run typecheck`, `bun run lint` for verification
- Commit after each logical task group
- Parser `import()` must preserve existing translations not being updated
