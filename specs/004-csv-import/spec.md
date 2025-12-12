# Feature Specification: CSV Import Command

**Feature Branch**: `004-csv-import`  
**Created**: 2024-11-30  
**Status**: Draft  
**Input**: User description: "Create import command that converts translated CSV back into the file system (inverse of extract)"

## Clarifications

### Session 2024-11-30

- Q: Should import handle CSVs with multiple target languages? → A: No, CSV always contains single target language (matches extract command behavior)
- Q: What data should parser.import() receive? → A: `Map<string, string>` of key→value pairs. CSV parsing handled by import-service, not parser.
- Q: How to specify which parser to use? → A: `--parser` / `-p` argument (default: node-module), matching extract command pattern.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import Translated CSV to File System (Priority: P1)

A developer has completed the translation workflow (extract → translate) and now has a CSV file containing translated values. They want to import these translations back into their translation file structure so the translations become part of their application.

**Why this priority**: This is the core functionality that completes the translation workflow loop. Without this, users must manually copy translations from the CSV into their translation files.

**Independent Test**: Can be fully tested by running the import command on a translated CSV and verifying the target language files are updated with the new translations.

**Acceptance Scenarios**:

1. **Given** a translated CSV with `translation_key`, `target_language`, and `translated_value` columns, **When** the user runs `aitranslate import <csv-file> -d <translations-dir> [-p <parser>]`, **Then** the system writes each translation to the appropriate target language file using the specified parser (default: node-module).

2. **Given** a translated CSV with keys like `generic.welcome` (dot-notation), **When** importing to node-module format, **Then** the system correctly writes to `generic.js` with nested structure `{ welcome: "..." }`.

3. **Given** a CSV where some translation keys already exist in target files, **When** importing, **Then** existing keys are updated with new values and other existing keys remain unchanged.

---

### Edge Cases

- What happens when a translation key references a file that doesn't exist yet? The system creates the file.
- What happens when the target language directory doesn't exist? The system creates it.
- What happens when the CSV contains malformed keys (empty, invalid characters)? The system skips with a warning.
- What happens when the parser doesn't support writing? The system reports an error with clear guidance.
- What happens when a key in the CSV doesn't match the expected structure (e.g., no file prefix)? The system warns and skips.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read translated CSV files containing at minimum `translation_key`, `target_language`, and `translated_value` columns.
- **FR-002**: System MUST parse translation keys in dot-notation format (e.g., `filename.nested.key`) back into file and nested key structure.
- **FR-003**: System MUST write translations to the appropriate file within the target language directory.
- **FR-004**: System MUST preserve existing translations in target files that are not being updated.
- **FR-005**: System MUST merge new translations with existing file content (update existing keys, add new keys).
- **FR-006**: System MUST create target files and directories that don't yet exist.
- **FR-007**: System MUST support the same parsers as the extract command for reading/writing translation files.
- **FR-008**: System MUST display a summary of imported translations (files modified, keys added/updated, errors).
- **FR-009**: System MUST skip rows where `translated_value` is empty and report them as skipped.

### Key Entities

- **Translation Row**: A single row from the CSV containing the key, languages, source value, and translated value.
- **Translation File**: A file in the translations directory that stores key-value pairs in a specific format (e.g., CommonJS module).
- **Parser**: A component that can both read from and write to translation files in a specific format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full extract → translate → import workflow and see translations appear in their target language files.
- **SC-002**: Import command completes processing a 1000-row CSV in under 30 seconds.
- **SC-003**: 100% of valid translations from CSV are correctly written to target files.
- **SC-004**: Existing translations not in the CSV remain unchanged after import.
