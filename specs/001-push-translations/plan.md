# Implementation Plan: CLI Translation Push

**Branch**: `[001-push-translations]` | **Date**: 2026-02-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-push-translations/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Replace the CSV extract workflow with a CLI command that extracts translation keys and uploads them to the backend in batches. The CLI sends API requests using the existing HTTP client in `services/http/client.ts` (same approach as auth), retries failed batches up to 3 times, and sends all keys so the backend can process duplicates and return counts.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (Bun runtime)  
**Primary Dependencies**: Bun, existing CLI extraction/analyzer modules  
**Storage**: N/A (file scanning + API requests)  
**Testing**: bun test (unit/integration/contract)  
**Target Platform**: CLI on macOS/Linux/Windows via Bun
**Project Type**: Single CLI project  
**Performance Goals**: Upload 100 keys per batch with <2s request latency  
**Constraints**: Strict TypeScript, no Node.js runtime, JSON + human-readable output, reuse `services/http/client.ts`  
**Scale/Scope**: Repos with up to 10k translation keys; single push command only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                              | Gate                                                                 | Status |
| -------------------------------------- | -------------------------------------------------------------------- | ------ |
| I. TypeScript-First CLI Design         | Strict TS, CLI-first I/O, JSON + human-readable output               | ⬜     |
| II. Bun.js Runtime                     | Bun-only runtime, bun run/build, no Node.js                          | ⬜     |
| III. Test-First Development            | Tests written before implementation                                  | ⬜     |
| IV. Test Completion Gate               | bun test passes before completion                                    | ⬜     |
| V. Simplicity & YAGNI                  | Minimal dependencies, no unnecessary features                        | ⬜     |

## Project Structure

### Documentation (this feature)

```text
specs/001-push-translations/
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
├── cli/
├── commands/
│   ├── extract.ts
│   └── pushTranslations.ts
├── services/
│   └── http/
│       └── client.ts
└── lib/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Single CLI project; new command in `src/commands` reusing `services/http/client.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
