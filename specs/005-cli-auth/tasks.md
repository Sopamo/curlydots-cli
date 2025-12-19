---

description: "Task list for CLI Authentication and Translation Push"
---

# Tasks: CLI Authentication and Translation Push

**Input**: Design documents from `/specs/005-cli-auth/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Mandatory per constitution. Every implementation task has corresponding tests that MUST be written first and executed via `bun test`.

**Organization**: Tasks are grouped by phase so each user story can be implemented, tested, and shipped independently.

## Format Reminder

`- [ ] T00X [P] [USY] Description with file path`

*[P] only when task can run fully in parallel. Story label omitted for setup/foundational/polish phases.*

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare CLI project dependencies, configuration, and developer tooling.

- [X] T001 Ensure Bun/TypeScript project metadata references new CLI feature in `package.json` and `bun.lockb`
- [X] T002 [P] Add required dependencies (keytar/libsecret helpers, open browser utility) in `package.json`
- [X] T003 [P] Configure `.env.example` and documentation for `CURLYDOTS_TOKEN` in `README.md`
- [X] T004 [P] Create feature-specific directories `src/cli/auth/` and `src/cli/translations/`
- [X] T005 Configure lint/test scripts for CLI feature in `package.json` (`bun run lint`, `bun test`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by all user stories. Complete before story work begins.

- [X] T006 Implement shared configuration loader in `src/config/cli-config.ts`
- [X] T007 [P] Implement secure storage abstraction (keychain + encrypted file) in `src/services/storage/secure-store.ts`
- [X] T008 [P] Create HTTP client with retry/backoff + error categories in `src/services/http/client.ts`
- [X] T009 Define shared CLI logger + user feedback helpers in `src/utils/logger.ts`
- [X] T010 Establish CLI command registration scaffold in `src/cli/index.ts`
- [X] T011 Add base unit test utilities for CLI commands in `tests/unit/cli/test-utils.ts`

**Checkpoint**: Foundation ready—user story phases can now run independently.

---

## Phase 3: User Story 1 – Browser-Based Authentication (Priority: P1) 🎯 MVP

**Goal**: `curlydots auth login` launches browser-based flow, long polls backend, stores token securely.

**Independent Test**: Running `curlydots auth login` on a clean machine opens browser, completes pairing, persists token, and reports success/errors clearly.

### Tests (write & run first)

- [X] T012 [P] [US1] Contract tests for `/auth/login` + `/auth/poll` in `tests/contract/auth-login.test.ts`
- [X] T013 [P] [US1] Integration test simulating full browser login flow in `tests/integration/cli-auth-login.test.ts`
- [X] T014 [P] [US1] Unit tests for secure storage + token persistence in `tests/unit/services/secure-store.test.ts`

### Implementation

- [ ] T015 [P] [US1] Implement pairing code generator + long polling controller in `src/services/auth/browser-login.ts`
- [ ] T016 [US1] Wire `curlydots auth login` command in `src/cli/auth/login.ts` (opens browser, monitors status)
- [ ] T017 [US1] Persist token with secure store + environment fallback in `src/services/auth/token-manager.ts`
- [ ] T018 [US1] Handle cancellation/timeouts with categorized errors in `src/cli/auth/login.ts`
- [ ] T019 [US1] Add status messaging + progress updates leveraging `src/utils/logger.ts`

**Checkpoint**: Authentication flow independently shippable (MVP complete).

---

## Phase 4: User Story 2 – Push Translation Data (Priority: P1)

**Goal**: `curlydots translations push` validates JSON payloads, authenticates, streams data to backend, and reports categorized errors.

**Independent Test**: With valid token + sample JSON, push command succeeds; expired tokens trigger re-auth flow; backend failures show categorized errors.

### Tests

- [ ] T020 [P] [US2] Contract tests for `/translations` + `/translations/status` in `tests/contract/translations-push.test.ts`
- [ ] T021 [P] [US2] Integration test pushing sample dataset with token renewal in `tests/integration/cli-translations-push.test.ts`
- [ ] T022 [P] [US2] Unit tests for translation validation schema in `tests/unit/parsers/translation-validator.test.ts`

### Implementation

- [ ] T023 [P] [US2] Implement translation schema validator + context mapping in `src/parsers/translation-validator.ts`
- [ ] T024 [US2] Build translation push service handling batching, streaming, and retries in `src/services/translations/push-service.ts`
- [ ] T025 [US2] Wire `curlydots translations push` CLI command with flags + stdin support in `src/cli/translations/push.ts`
- [ ] T026 [US2] Implement push status reporter (requestId lookup) in `src/cli/translations/status.ts`
- [ ] T027 [US2] Integrate token validation/renewal before push operations in `src/services/auth/token-manager.ts`

**Checkpoint**: Translation push story independently deliverable.

---

## Phase 5: User Story 3 – Token Management (Priority: P2)

**Goal**: Users can view current auth status and revoke tokens via CLI commands.

**Independent Test**: Running `curlydots auth status/logout` displays accurate info and removes tokens without affecting other flows.

### Tests

- [ ] T028 [P] [US3] Unit tests for status presenter + formatter in `tests/unit/cli/auth-status.test.ts`
- [ ] T029 [P] [US3] Integration test covering logout/token revocation in `tests/integration/cli-auth-logout.test.ts`

### Implementation

- [ ] T030 [P] [US3] Implement token metadata formatter in `src/services/auth/status-presenter.ts`
- [ ] T031 [US3] Wire `curlydots auth status` command (read-only) in `src/cli/auth/status.ts`
- [ ] T032 [US3] Wire `curlydots auth logout` command (revoke + cleanup) in `src/cli/auth/logout.ts`
- [ ] T033 [US3] Add CI/CD token injection checks + helpful errors in `src/cli/auth/common.ts`

**Checkpoint**: Token management independently complete.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T034 [P] Update `quickstart.md` and `README.md` with final command usage
- [ ] T035 [P] Add telemetry/log masking for sensitive values in `src/utils/logger.ts`
- [ ] T036 [P] Improve performance (batch tuning, streaming) with profiling notes in `src/services/translations/push-service.ts`
- [ ] T037 Run full verification suite: `bun run lint`, `bun run typecheck`, `bun test`
- [ ] T038 Prepare release notes + CLI help output in `src/cli/index.ts`

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2** (sequential): Setup precedes foundational.
- **Phase 2 → Phases 3-5**: All user stories depend on foundational tasks.
- **User Stories**: US1 (P1) unlocks MVP, US2 (P1) can proceed parallel once Phase 2 done, US3 (P2) can run after US1 foundation shared modules available.
- **Polish**: Run after desired stories complete.

---

## Parallel Execution Examples

### User Story 1
```text
[P] Tests (T012-T014) can run concurrently.
[P] Implementation components T015 & T017 can proceed in parallel (different files) after tests written.
```

### User Story 2
```text
Validators (T023) and push service (T024) can start simultaneously once foundational code is ready.
CLI wiring tasks (T025, T026) wait for respective services.
```

### User Story 3
```text
Status presenter (T030) and CLI commands (T031-T033) can be split among contributors after tests.
```

---

## Implementation Strategy

1. **MVP First**: Complete Phases 1-3 (Setup, Foundational, US1) and verify `curlydots auth login`.
2. **Incremental Delivery**:
   - Add US2 to enable translation push workflows.
   - Add US3 for advanced token management.
3. **Parallel Team Support**:
   - After Phase 2, different engineers can own US1/US2/US3 concurrently.
4. **Verification Gate**:
   - After each story, run lint + typecheck + test suite.

**Suggested MVP Scope**: Up to User Story 1 (authentication). Subsequent releases can add translation push and token management.

---

## Summary

- **Total Tasks**: 38  
- **By Story**: US1 (8 tasks), US2 (8 tasks), US3 (6 tasks)  
- **Parallel Opportunities**: Tasks marked [P] within each phase/story  
- **Independent Tests**: Documented per story above

