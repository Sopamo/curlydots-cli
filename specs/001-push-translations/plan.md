# Implementation Plan: Push Translations Command

**Branch**: `001-push-translations` | **Date**: 2026-01-16 | **Spec**: ../spec.md
**Input**: Feature specification from `/specs/001-push-translations/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement `aitranslate translations push` to analyze translation keys, gather code context and source values, diff against backend keys, and upload only missing keys. The command takes explicit CLI arguments, validates auth before scanning, batches uploads (default 100), aborts on first failed batch, and uses the existing auth HTTP client pattern (or a minimal shared client if missing).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (strict)  
**Primary Dependencies**: Bun runtime, Ink, fast-csv, p-limit, zustand  
**Storage**: Local filesystem (translation files, auth token store)  
**Testing**: `bun test` (unit/integration/contract)  
**Target Platform**: Cross-platform CLI (Bun)  
**Project Type**: Single CLI repository  
**Performance Goals**: Upload 1,000 new keys with context in <60s on typical repos  
**Constraints**: Bun-only runtime, strict TypeScript, CLI I/O via stdout/stderr, JSON + human output formats  
**Scale/Scope**: Typical repo <5MB source; context search across default extensions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- TypeScript-first CLI design (strict mode, no `any` without comment) → Pass
- Bun-only runtime (no Node APIs) → Pass
- CLI output supports JSON + human-readable formats → Planned
- Test-first development and bun test gate → Planned
- Simplicity/YAGNI → Pass

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── commands/
├── parsers/
├── services/
├── stores/
├── types/
└── ui/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Single CLI project. New command and services live under `src/commands` and `src/services`, tests under `tests/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
