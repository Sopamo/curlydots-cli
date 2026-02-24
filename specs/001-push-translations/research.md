# Research: Push Translations Command

## Decision 1: HTTP client reuse for API requests

**Decision**: Reuse the existing HTTP client used by auth/login (expected at `src/services/http/client.ts`). If the client does not exist in this repo, create a minimal HTTP client following the auth request pattern and document its location.

**Rationale**: The user requested reusing the auth HTTP client to keep API behavior consistent (headers, error handling, retries). Confirming its location prevents duplicate implementations.

**Alternatives considered**:
- Use raw `fetch` directly in the new command (rejected: duplicates request logic and error handling).
- Add a new HTTP client module in the push command (rejected: would diverge from existing auth patterns).

## Decision 2: API endpoints and payloads

**Decision**: Define two backend endpoints:
1) `GET /api/projects/{projectUuid}/translation-keys` to return all existing keys.
2) `POST /api/projects/{projectUuid}/translation-keys` to upload new keys in batches.

**Rationale**: This matches the requirement to fetch all existing keys in a single response and upload only missing keys in batches.

**Alternatives considered**:
- Uploading everything and letting the backend dedupe (rejected: wastes bandwidth and ignores diff requirement).

## Decision 3: Authentication source precedence

**Decision**: Resolve the API token using:
1) `--api-token` argument (highest priority)
2) CLI auth token store from `aitranslate login`
If neither is present, fail fast before scanning.

**Rationale**: Aligns with clarified requirements and avoids scanning without valid credentials.

**Alternatives considered**:
- Environment variable fallback (rejected: not requested).
- Delayed auth validation after scan (rejected: fail-fast requirement).
