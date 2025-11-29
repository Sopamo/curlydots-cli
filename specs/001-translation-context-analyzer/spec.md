# Feature Specification: Translation Context Analyzer

**Feature Branch**: `001-translation-context-analyzer`  
**Created**: 2025-11-29  
**Status**: Draft  
**Updated**: 2025-11-29  
**Input**: User description: "Analyze translation files in a given repository (by url), find missing translations for a target language, then for each of the translation keys, search through the whole repository for usages of that key and collect them. Output a csv file with translation key, source language, target language, context. The context is supposed to be an array of pieces of code with +-15 lines of code around the usage of that translation key. Add at most 10 pieces of context for each translation key."

**Update 2025-11-29**: Added source_value column, renamed context→code_context, added translation_context for noun-based translation examples.

**Update 2025-11-29**: Added TUI specification with checklist-style progress display and progress bar for long-running tasks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find Missing Translations (Priority: P1)

As a developer maintaining a multi-language application, I want to identify which translation keys exist in the source language but are missing in a target language, so I can prioritize translation work.

**Why this priority**: This is the core functionality—without identifying missing translations, the context collection has no value. This story alone provides immediate value by generating a list of missing keys.

**Independent Test**: Run the CLI with a local repository path, source language (e.g., "en"), and target language (e.g., "de"). The output CSV lists all translation keys that exist in "en" but are missing in "de".

**Acceptance Scenarios**:

1. **Given** a local repository path with translation files containing keys in English but missing some in German, **When** user runs the tool with `--source en --target de`, **Then** the output CSV contains all keys present in English but absent in German
2. **Given** a repository where all English keys have German translations, **When** user runs the tool with `--source en --target de`, **Then** the output CSV is empty (header only) or displays "No missing translations found"
3. **Given** an invalid local path, **When** user runs the tool, **Then** a clear error message indicates the path does not exist or is not accessible

---

### User Story 2 - Collect Usage Context (Priority: P2)

As a translator, I want to see how each translation key is used in the codebase, so I can provide accurate translations that fit the context.

**Why this priority**: Context collection enhances the value of missing translation data but depends on first identifying which keys are missing. This story transforms raw key data into actionable translation guidance.

**Independent Test**: Run the CLI with context collection enabled. For each missing translation key, the output includes code snippets showing where and how the key is used in the repository.

**Acceptance Scenarios**:

1. **Given** a missing translation key "welcome.message" used in 3 files, **When** the tool collects context, **Then** the CSV contains up to 3 code_context snippets for that key (each with ±15 lines around usage)
2. **Given** a missing translation key used in 15 different locations, **When** the tool collects context, **Then** the CSV contains exactly 10 code_context snippets (the maximum limit)
3. **Given** a missing translation key that is never used in code, **When** the tool collects context, **Then** the code_context field is empty or marked as "No usages found"

---

### User Story 4 - Translation Context Examples (Priority: P2)

As a translator, I want to see how nouns in the source text have been translated previously, so I can maintain consistency with existing translations.

**Why this priority**: Translation context improves translation quality by showing established patterns. This depends on having the source value and existing translations available.

**Independent Test**: For a source value containing nouns that appear in other already-translated keys, the output includes examples of how those nouns were previously translated.

**Acceptance Scenarios**:

1. **Given** a missing translation with source value "Show all users" and an existing translation "Delete all users" → "Alle Benutzer:innen löschen", **When** the tool collects translation context, **Then** the translation_context includes the example showing "users" → "Benutzer:innen"
2. **Given** a source value with 3 distinct nouns each used in other translations, **When** the tool collects context, **Then** at least one example per noun is included (if available)
3. **Given** a source value "Show all users" with the noun "users" appearing in 15 different existing translations, **When** the tool reaches 10 examples, **Then** no more examples are added
4. **Given** a source value with nouns not found in any other translations, **When** the tool collects context, **Then** the translation_context field is empty

---

### User Story 3 - CSV Export with Structured Output (Priority: P3)

As a project manager, I want the analysis results in a CSV file that I can share with translators and track in spreadsheets, so I can coordinate translation efforts efficiently.

**Why this priority**: Output formatting is essential for usability but is downstream of the core analysis. The data must first be collected before formatting matters.

**Independent Test**: Run the tool and verify the output file is valid CSV with the specified columns that can be opened in spreadsheet software.

**Acceptance Scenarios**:

1. **Given** the tool has identified missing translations with context, **When** export completes, **Then** a CSV file is created with columns: "translation_key", "source_value", "source_language", "target_language", "code_context", "translation_context"
2. **Given** code_context or translation_context contains special characters (quotes, commas, newlines), **When** exported to CSV, **Then** the file is properly escaped and parseable by standard CSV readers
3. **Given** user specifies an output path via `--output`, **When** the tool runs, **Then** the CSV is written to the specified location

---

### User Story 5 - TUI Progress Display (Priority: P3)

As a developer running the analysis tool, I want to see clear visual feedback on what the tool is doing and how far along it is, so I can understand the progress and estimate completion time.

**Why this priority**: Progress feedback improves user experience but is not essential for core functionality. The tool must work correctly before displaying progress nicely.

**Independent Test**: Run the CLI. The terminal displays a configuration summary followed by a checklist of tasks that update in real-time as the analysis progresses.

**Acceptance Scenarios**:

1. **Given** user runs the tool, **When** the tool starts, **Then** a configuration summary is displayed showing:
   - Repository path
   - Translations directory
   - Source language → Target language
   - Parser name
   - Output file path

2. **Given** the TUI is active, **When** analysis begins, **Then** a checklist of tasks is displayed:
   - [ ] Find source translation keys
   - [ ] Find target translation keys
   - [ ] Find missing translations
   - [ ] Find code usage context
   - [ ] Find existing translation context
   - [ ] Export CSV file

3. **Given** a task in the checklist completes, **When** the next task starts, **Then** the completed task is marked with a checkmark (✓) and the current task is visually indicated as in-progress

4. **Given** the "Find code usage context" task is running with 50 missing keys, **When** 25 keys have been processed, **Then** a progress bar below the checklist shows 50% complete

5. **Given** the "Find existing translation context" task is running, **When** processing, **Then** a progress bar shows completion percentage based on missing keys processed

6. **Given** all tasks complete, **When** the analysis finishes, **Then** all checklist items show checkmarks and a completion summary is displayed

---

### Edge Cases

- **No translation files found**: Repository exists but contains no recognizable translation file formats → Clear error message listing expected formats
- **Unsupported translation format**: Repository uses a translation format not supported by the tool → Error with list of supported formats
- **Large repository**: Repository contains thousands of files → Tool completes within reasonable time; progress indication provided
- **Binary files**: Repository contains binary files that match search patterns → Binary files are skipped without error
- **Nested translation keys**: Keys like "errors.validation.required" → Properly handled and searchable
- **Permission denied**: Local path exists but is not readable → Clear permission error message

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a local repository path as input
- **FR-002**: System MUST accept source language and target language parameters
- **FR-002a**: System MUST accept `--translations-dir <path>` to specify translation files location relative to repo root
- **FR-003**: System MUST read directly from the provided local path (no cloning required)
- **FR-004**: System MUST support a pluggable parser architecture with `--parser <name>` CLI option
- **FR-004a**: System MUST ship with "node-module" parser as the initial/default parser
- **FR-004b**: The "node-module" parser MUST handle CommonJS `module.exports` JavaScript files in `<translations-dir>/<lang>/` folder structure
- **FR-005**: System MUST identify translation keys present in source language but missing in target language
- **FR-006**: System MUST search the entire repository for usages of each missing translation key
- **FR-006a**: Search MUST match literal key strings: `'key'`, `"key"`, and unquoted `key` occurrences
- **FR-006b**: System MUST support `--extensions <list>` to specify file types to search (default: `.js,.ts,.jsx,.tsx,.vue,.svelte,.html`)
- **FR-007**: System MUST extract ±15 lines of code context around each usage found
- **FR-008**: System MUST limit context snippets to a maximum of 10 per translation key
- **FR-009**: System MUST output results as a CSV file with columns: translation_key, source_value, source_language, target_language, code_context, translation_context
- **FR-010**: System MUST properly escape CSV special characters in context snippets
- **FR-011**: System MUST support specifying output file path via command-line argument
- **FR-012**: System MUST NOT modify the source repository; read-only access only
- **FR-013**: System MUST provide human-readable progress output to stderr during long operations
- **FR-014**: System MUST include the source language value for each missing translation key in the output
- **FR-015**: System MUST detect nouns in source translation values
- **FR-016**: System MUST search for existing translations containing the same nouns
- **FR-017**: System MUST collect up to 10 translation context examples per missing key
- **FR-018**: System MUST prioritize one example per distinct noun before adding multiple examples for the same noun
- **FR-019**: Translation context examples MUST include the source key, source value, and target value showing the noun translation
- **FR-020**: System MUST always display interactive terminal UI (TUI) when running
- **FR-021**: TUI MUST display a configuration summary showing repository path, translations directory, source/target languages, parser name, and output path
- **FR-022**: TUI MUST display a checklist of 6 tasks in order: find source keys, find target keys, find missing translations, find code usage context, find existing translation context, export CSV
- **FR-023**: TUI MUST mark each task with a checkmark (✓) when completed
- **FR-024**: TUI MUST visually indicate which task is currently in progress
- **FR-025**: TUI MUST display a progress bar below the checklist during "find code usage context" task
- **FR-026**: TUI MUST display a progress bar below the checklist during "find existing translation context" task
- **FR-027**: Progress bar MUST show percentage based on (processed missing keys / total missing keys)
- **FR-028**: TUI MUST display a completion summary when all tasks finish

### Key Entities

- **TranslationKey**: A unique identifier for a translatable string (e.g., "welcome.message", "errors.not_found"); has a key path and optional namespace
- **TranslationFile**: A file containing translation key-value pairs for a specific language; has a file path, language code, and format type
- **CodeContext**: A code snippet showing where a translation key is used; contains file path, line number, and ±15 lines of surrounding code (formerly "UsageContext")
- **TranslationContextExample**: An example of how a noun was previously translated; contains the source key, source value, target value, and the matched noun
- **MissingTranslation**: A translation key that exists in source language but not in target; includes the key, source value, source language, target language, collected code contexts, and translation context examples

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tool correctly identifies 100% of missing translation keys when comparing source and target language files
- **SC-002**: Code context extraction captures the correct ±15 lines around each usage (30 total lines of context per snippet)
- **SC-003**: Output CSV is valid and parseable by standard spreadsheet applications (Excel, Google Sheets, LibreOffice)
- **SC-005**: Translation context examples correctly identify nouns and find relevant prior translations
- **SC-006**: Source value is included for every missing translation in the output
- **SC-004**: No modifications made to source repository during analysis
- **SC-007**: TUI mode displays real-time progress with checklist updates and progress bar for long-running tasks

## Assumptions

- Local repository path is readable by the user running the tool
- Translation keys in code are used as string literals that can be found via text search
- The "node-module" parser expects structure: `<translations-dir>/<lang>/*.js` with CommonJS exports
- Nested keys are flattened with dot notation (e.g., `suggest_question.submit_question`)
- Plural forms and interpolation syntax are preserved as-is in source values
- Noun detection uses natural language processing to identify nouns in source values
- Noun matching is case-insensitive and handles plural/singular forms (e.g., "user" matches "users")

## Clarifications

### Session 2025-11-29

- Q: How are translation file formats handled? → A: Pluggable parser architecture; user specifies `--parser <name>`
- Q: Which parser to implement first? → A: "node-module" parser for CommonJS JS files in `<lang>/` folder structure
- Q: Reference implementation structure? → A: Based on keelearning pattern: `src/translations/<lang>/*.js` with `module.exports = { key: value }`
- Q: How to specify translations directory? → A: Required `--translations-dir <path>` CLI argument
- Q: How to find translation key usages in code? → A: Literal string search for `'key'`, `"key"`, and unquoted `key`
- Q: Which files to search for context? → A: Configurable `--extensions` flag with defaults: `.js,.ts,.jsx,.tsx,.vue,.svelte,.html`
- Q: URL or local path input? → A: Local paths only, no URL/clone support

### Session 2025-11-29 (Update)

- Q: What columns should the CSV have? → A: translation_key, source_value, source_language, target_language, code_context, translation_context
- Q: What is code_context? → A: Renamed from "context" - array of code snippets where the key is used
- Q: What is translation_context? → A: Examples of how nouns in the source value were translated in other existing translations
- Q: How are translation context examples prioritized? → A: First, one example per noun; then additional examples until 10 total or none left
- Q: What does a translation context example contain? → A: Source key, source value, target value, and the matched noun

### Session 2025-11-29 (TUI)

- Q: Should TUI be optional? → A: No, TUI is always displayed when running the tool (no flag needed)
- Q: How should progress be displayed? → A: Checklist-style with 6 tasks that get marked as done (✓) as they complete
- Q: Which tasks should show a progress bar? → A: Only "find code usage context" and "find existing translation context" (long-running tasks)
- Q: How is progress calculated? → A: Based on processed missing keys / total missing keys
- Q: What config info should be shown? → A: Repository path, translations directory, source/target languages, parser name, output path
- Q: What are the 6 checklist tasks in order? → A: (1) Find source translation keys, (2) Find target translation keys, (3) Find missing translations, (4) Find code usage context, (5) Find existing translation context, (6) Export CSV file
