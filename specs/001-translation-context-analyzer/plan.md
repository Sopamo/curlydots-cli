# Implementation Plan: Translation Context Analyzer

**Branch**: `001-translation-context-analyzer` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-translation-context-analyzer/spec.md`

## Summary

CLI tool to analyze translation files, identify missing translations between source and target languages, collect code usage context and translation context examples, and export results to CSV. Features an always-on TUI with checklist-style progress display using Ink and Zustand state management.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: Ink 5.x (TUI), React 18.x, Zustand 5.x (state), wink-nlp (NLP)  
**Storage**: File-based (reads translation files, writes CSV)  
**Testing**: `bun test` (native Bun test runner)  
**Target Platform**: CLI on macOS/Linux (Bun.js runtime)
**Project Type**: Single CLI application  
**Performance Goals**: Process 1000+ translation keys in <10 seconds  
**Constraints**: Read-only access to repository, <100MB memory  
**Scale/Scope**: Support repositories with up to 10,000 translation keys

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First CLI | ✅ Pass | TypeScript with `strict: true`, CLI interface |
| II. Bun.js Runtime | ✅ Pass | Using Bun exclusively, `bun test` for testing |
| III. Test-First Development | ✅ Pass | Tests written before implementation |
| IV. Test Completion Gate | ✅ Pass | All 96 tests passing |
| V. Simplicity & YAGNI | ✅ Pass | Minimal dependencies, clear purpose |
| Verification After Changes | ✅ Pass | Running typecheck, lint, test after changes |

## Project Structure

### Documentation (this feature)

```text
specs/001-translation-context-analyzer/
├── plan.md              # This file
├── research.md          # Technology decisions
├── data-model.md        # Types and state definitions
├── quickstart.md        # Usage examples
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
src/
├── index.ts             # CLI entry point
├── types/
│   └── index.ts         # Shared type definitions
├── stores/
│   ├── index.ts         # Store exports
│   ├── config.ts        # Config store (CLI args)
│   └── analysis.ts      # Analysis store (progress, tasks)
├── parsers/
│   ├── index.ts         # Parser registry
│   └── node-module.ts   # CommonJS parser
├── services/
│   ├── analyzer.ts      # Missing translation detection
│   ├── context-finder.ts # Code context extraction
│   ├── translation-context.ts # Noun detection + examples
│   └── csv-writer.ts    # CSV output
└── ui/
    ├── index.ts         # UI exports
    ├── app.tsx          # Ink app root
    └── views/
        ├── index.ts     # View exports
        └── progress.tsx # TUI checklist + progress bars

tests/
├── fixtures/
│   └── sample-repo/     # Test translation files
├── unit/
│   ├── stores/          # Store tests
│   ├── parsers/         # Parser tests
│   ├── services/        # Service tests
│   └── ui/views/        # UI component tests
└── integration/         # End-to-end tests
```

**Structure Decision**: Single CLI project with clear separation between stores (Zustand state), services (business logic), parsers (translation file reading), and UI (Ink TUI components).

## TUI State Management (Zustand)

Per user requirement, all TUI state is managed via Zustand in `src/stores/analysis.ts`:

### Task Checklist State

```typescript
// 6 tasks tracked in order
const tasks: TaskState[] = [
  { id: 'find_source_keys', label: 'Find source translation keys', status: 'pending' },
  { id: 'find_target_keys', label: 'Find target translation keys', status: 'pending' },
  { id: 'find_missing', label: 'Find missing translations', status: 'pending' },
  { id: 'find_code_context', label: 'Find code usage context', status: 'pending', progress: 0 },
  { id: 'find_translation_context', label: 'Find existing translation context', status: 'pending', progress: 0 },
  { id: 'export_csv', label: 'Export CSV file', status: 'pending' },
];
```

### Progress Bar State

Only tasks 4 and 5 have progress bars:

```typescript
// Progress calculated from processed/total missing keys
setTaskProgress('find_code_context', processed, totalMissing);
setTaskProgress('find_translation_context', processed, totalMissing);
```

### Actions

| Action | Purpose |
|--------|---------|
| `startTask(taskId)` | Mark task as `in_progress` |
| `completeTask(taskId)` | Mark task as `complete` |
| `setTaskProgress(taskId, processed, total)` | Update progress bar (tasks 4 & 5 only) |
| `reset()` | Reset all tasks to `pending` |

## Complexity Tracking

> No violations requiring justification.
