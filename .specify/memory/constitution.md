<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.0.0 → 1.1.0
  
  Modified principles:
  - I. TypeScript-First CLI Design: Clarified `any` type policy (allowed with mandatory comment)
  
  Added sections:
  - Development Workflow > Verification After Changes (biome + typecheck)
  
  Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ No changes needed
  - .specify/templates/spec-template.md: ✅ No changes needed
  - .specify/templates/tasks-template.md: ✅ No changes needed
  
  Follow-up TODOs: None
-->

# AITranslate Constitution

## Core Principles

### I. TypeScript-First CLI Design

All code MUST be written in TypeScript with strict type checking enabled.

- **Type Safety**: `strict: true` in `tsconfig.json` is non-negotiable
- **CLI Interface**: All features MUST be accessible via command-line interface
- **Text I/O Protocol**: stdin/args → stdout for output, stderr for errors
- **Output Formats**: MUST support both JSON and human-readable output formats
- **Avoid `any` Types**: Explicit typing required; `unknown` with type guards preferred. If `any` is genuinely required (e.g., third-party library callback), it MUST include a comment explaining why the type is truly `any`

**Rationale**: TypeScript provides compile-time safety and better tooling. CLI-first ensures scriptability and composability with other tools.

### II. Bun.js Runtime (No Node.js)

Bun.js is the ONLY supported runtime. Node.js MUST NOT be used.

- **Package Manager**: Use `bun` exclusively (not npm, yarn, or pnpm)
- **Test Runner**: Use `bun test` for all testing
- **Script Execution**: Use `bun run` for all scripts
- **Dependencies**: Prefer Bun-native APIs over Node.js polyfills when available
- **Bundling**: Use `bun build` for production builds when needed

**Rationale**: Bun provides faster execution, built-in TypeScript support, and unified tooling. Mixing runtimes creates complexity and inconsistency.

### III. Test-First Development (NON-NEGOTIABLE)

Every feature and task MUST have tests written BEFORE implementation begins.

- **Red-Green-Refactor**: Tests written → Tests fail (red) → Implement → Tests pass (green) → Refactor
- **Test Location**: All tests in `tests/` directory with subdirectories for `unit/`, `integration/`, `contract/`
- **Test Naming**: Test files MUST match source files: `src/foo.ts` → `tests/unit/foo.test.ts`
- **Coverage Expectation**: New code MUST have corresponding test coverage

**Rationale**: TDD ensures requirements are understood before coding and prevents regressions. Writing tests first forces clearer API design.

### IV. Test Completion Gate (NON-NEGOTIABLE)

A task or feature is NOT complete until ALL associated tests pass.

- **Gate Enforcement**: `bun test` MUST pass with zero failures before task completion
- **No Skipped Tests**: `.skip()` or `.todo()` tests MUST be resolved, not left indefinitely
- **CI Requirement**: Tests MUST pass in CI before any merge
- **Blocking Merge**: Failed tests block completion—no exceptions

**Rationale**: Passing tests are the objective measure of task completion. Incomplete tests mean incomplete work.

### V. Simplicity & YAGNI

Start simple. Add complexity only when proven necessary.

- **YAGNI Principle**: Do not implement features until they are actually needed
- **Minimal Dependencies**: Prefer standard library and Bun built-ins over external packages
- **Clear Purpose**: Every file, function, and module MUST have a clear, documented purpose
- **No Premature Optimization**: Optimize only after profiling identifies bottlenecks

**Rationale**: Simple code is easier to test, maintain, and debug. Complexity must justify itself.

## Technology Stack

The following technology choices are binding for this project:

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Language** | TypeScript 5.x | Type safety, tooling |
| **Runtime** | Bun.js (latest stable) | Speed, unified tooling |
| **Testing** | `bun test` | Native integration |
| **Linting** | Biome or ESLint | Code consistency |
| **Formatting** | Biome or Prettier | Code style |

**Prohibited**:
- Node.js runtime
- npm/yarn/pnpm package managers
- Jest, Mocha, or other non-Bun test runners

## Development Workflow

### Verification After Changes (MANDATORY)

After ANY code changes, the following checks MUST be run:

```bash
bun run typecheck   # TypeScript type checking (tsc --noEmit)
bun run lint        # Biome linting and formatting
bun test            # All tests pass
```

**Rationale**: Running verification immediately catches type errors, style issues, and regressions before they propagate.

### Task Completion Checklist

Every task MUST satisfy these criteria before being marked complete:

1. **Tests Written**: Unit and/or integration tests exist for the feature
2. **Tests Pass**: `bun test` exits with code 0
3. **Types Check**: `bun run typecheck` (or `tsc --noEmit`) passes
4. **Lint Pass**: No Biome errors (`bun run lint`)
5. **Documentation**: Public APIs have JSDoc comments

### Branch & Commit Standards

- Feature branches: `feature/###-description`
- Commits: Conventional commits format (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`)
- Each commit SHOULD leave tests passing

## Governance

This constitution supersedes all other development practices in this project.

- **Compliance**: All code changes MUST verify compliance with these principles
- **Amendments**: Changes to this constitution require documented justification
- **Exceptions**: Violations require explicit documentation in the relevant plan.md with rationale
- **Review**: Periodic review of constitution for relevance (quarterly recommended)

**Version**: 1.1.0 | **Ratified**: 2025-11-29 | **Last Amended**: 2025-11-29
