# Data Model: Push Translations Command

## Entities

### Project
- **Identifier**: `projectUuid` (UUID, required)
- **Relationships**: Owns many translation keys
- **Constraints**:
  - `projectUuid` must be supplied by the CLI for all API calls

### TranslationKeyPayload
- **Identifier**: `translationKey` (string, required)
- **Fields**:
  - `translationKey`: string, unique per project
  - `sourceValue`: string, required
  - `sourceLanguage`: string, required (default language)
  - `codeContext`: array of UsageContext, required (may be empty)
- **Constraints**:
  - `translationKey` may repeat in a batch; backend reports duplicates
  - `codeContext` is capped to 10 items

### UsageContext
- **Fields**:
  - `filePath`: string (absolute path)
  - `lineNumber`: number (1-indexed)
  - `snippet`: string
  - `snippetStartLine`: number (1-indexed)
  - `snippetEndLine`: number (1-indexed)
- **Constraints**:
  - Each snippet corresponds to the searched translation key

## State/Workflow

1. CLI validates auth and inputs.
2. CLI scans repo and builds `TranslationKeyPayload` for each key.
3. CLI fetches existing keys from the backend and filters out known keys.
4. CLI uploads only new keys in batches (default 100).
