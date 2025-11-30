# Implementation Plan: CSV Translation with AI

**Branch**: `002-csv-translation` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-csv-translation/spec.md`

## Summary

Add `aitranslate translate <csv>` subcommand that translates missing translation entries using OpenAI GPT-5.1. The system reads CSV files produced by the extraction feature, sends each row to OpenAI with full context (code snippets + prior translation examples), and outputs a new CSV with an added `translated_value` column. Uses OpenAI SDK with Responses API, XML-formatted prompts, and JSON schema enforcement for structured output.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: OpenAI SDK (`openai`), Ink (TUI), Zustand (state), p-limit (concurrency), fast-csv (CSV parsing/writing)  
**Storage**: CSV files (read/write via Bun APIs)  
**Testing**: `bun test` (unit + integration)  
**Target Platform**: CLI on Linux/macOS/Windows via Bun.js  
**Project Type**: Single CLI project  
**Performance Goals**: Process 100 rows in reasonable time (API-bound); 5 concurrent requests default  
**Constraints**: Incremental writes for crash recovery; <5 consecutive failures before abort  
**Scale/Scope**: Hundreds to low thousands of translation rows per CSV

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First CLI Design | ✅ PASS | All code TypeScript strict; CLI subcommand pattern |
| II. Bun.js Runtime | ✅ PASS | Bun for runtime, testing, file I/O |
| III. Test-First Development | ✅ PASS | Tests before implementation per task |
| IV. Test Completion Gate | ✅ PASS | `bun test` must pass before completion |
| V. Simplicity & YAGNI | ✅ PASS | Minimal dependencies; OpenAI SDK is necessary |

**Gate Status**: ✅ ALL GATES PASS — Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/002-csv-translation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAI prompt/response schemas)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── index.ts             # CLI entry - refactor to subcommand router
├── commands/            # NEW: Subcommand handlers
│   ├── extract.ts       # Moved from index.ts (existing functionality)
│   └── translate.ts     # NEW: Translation command
├── services/
│   ├── analyzer.ts      # Existing
│   ├── context-finder.ts # Existing
│   ├── csv-writer.ts    # Existing (extend for translated output)
│   ├── csv-reader.ts    # NEW: Read CSV with translated_value column
│   ├── translation-context.ts # Existing
│   └── openai/          # NEW: OpenAI integration
│       ├── client.ts    # OpenAI SDK wrapper
│       ├── prompts.ts   # XML prompt builder
│       └── schemas.ts   # JSON response schemas
├── stores/
│   └── translation-store.ts # NEW: State for translate command
├── types/
│   └── index.ts         # Extend with translation types
└── ui/
    └── views/
        └── translate-progress.tsx # NEW: TUI for translate command

tests/
├── unit/
│   ├── services/
│   │   ├── csv-reader.test.ts    # NEW
│   │   └── openai/
│   │       ├── client.test.ts    # NEW
│   │       ├── prompts.test.ts   # NEW
│   │       └── schemas.test.ts   # NEW
│   └── commands/
│       └── translate.test.ts     # NEW
└── integration/
    └── translate-flow.test.ts    # NEW: End-to-end translation flow
```

**Structure Decision**: Extends existing single-project structure. New `commands/` directory for subcommand separation. New `services/openai/` for OpenAI-specific logic isolation.

## Implementation Decisions

### OpenAI Integration (User Requirements)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SDK | `openai` npm package | Official SDK, TypeScript types, Responses API support |
| API | Responses API (`openai.responses.create()`) | User requirement; newer API with better structured output |
| Model | GPT-5.1 with `reasoning_effort: "low"` | User requirement; model does not support temperature/max_tokens |
| Input Format | XML | User requirement; clear structure for context separation |
| Output Format | JSON Schema `{translated_value: string}` | Minimal schema; enforced via `response_format` parameter |
| Schema Enforcement | `json_schema` response format with `strict: true` | OpenAI structured outputs guarantee valid JSON |

### CLI Refactoring

The existing CLI in `src/index.ts` will be refactored:
- Root command becomes router for subcommands
- `aitranslate extract` — existing functionality (moved)
- `aitranslate translate` — new functionality
- No backward compatibility: explicit subcommand required

### CSV Library Migration

The existing `src/services/csv-writer.ts` will be refactored:
- Replace manual string escaping with `fast-csv` format API
- Add new `src/services/csv-reader.ts` using `fast-csv` parse API
- Consistent CSV handling across read and write operations

## Complexity Tracking

> No constitution violations — table not needed
