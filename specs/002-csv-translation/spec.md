# Feature Specification: CSV Translation with AI

**Feature Branch**: `002-csv-translation`  
**Created**: 2025-11-29  
**Status**: Draft  
**Input**: User description: "Implement a new feature where given a CSV that was extracted with the existing bun command, we now translate that CSV by inserting a new column with the new value in the target language. It should use OpenAI with GPT-4.1. The AI should get all the context so that it can properly translate the value."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Translate CSV with AI Context (Priority: P1)

As a developer who has extracted missing translations to a CSV file, I want to automatically translate all entries using AI that understands the code and translation context, so I can quickly get high-quality translations without manual effort.

**Why this priority**: This is the core functionality—the entire feature exists to transform a CSV of missing translations into a CSV with AI-generated translations. Without this, there is no feature.

**Independent Test**: Run the translate command with a valid CSV file containing missing translations. The output CSV contains a new column with AI-generated translations for each row.

**Acceptance Scenarios**:

1. **Given** a CSV file with columns (translation_key, source_value, source_language, target_language, code_context, translation_context), **When** user runs the translate command, **Then** the output CSV contains an additional "translated_value" column with AI-generated translations
2. **Given** a row with code_context showing the key is used in a button, **When** the AI translates "Submit", **Then** the translation reflects button context (e.g., German "Absenden" rather than generic "Einreichen")
3. **Given** a row with translation_context showing "users" was previously translated as "Benutzer:innen", **When** the AI translates "Show all users", **Then** the translation uses the consistent term "Benutzer:innen"
4. **Given** a CSV with 100 rows, **When** translation completes, **Then** all 100 rows have a translated_value populated

---

### User Story 2 - Progress Feedback During Translation (Priority: P2)

As a user running translations on a large CSV, I want to see progress feedback, so I can estimate how long the process will take and confirm it's working.

**Why this priority**: Translation via API can be slow for large files. Without progress feedback, users may think the tool is frozen or terminate it prematurely.

**Independent Test**: Run the translate command on a CSV with 10+ rows. The terminal displays progress indicating how many rows have been translated out of total.

**Acceptance Scenarios**:

1. **Given** a CSV with 50 rows, **When** translation is running, **Then** the TUI displays progress (e.g., "Translating: 25/50")
2. **Given** the translation is in progress, **When** a row completes, **Then** the progress display updates in real-time
3. **Given** all rows are translated, **When** the process completes, **Then** a summary shows total translations completed

---

### User Story 3 - Handle API Errors Gracefully (Priority: P2)

As a user translating a CSV, I want the tool to handle API failures gracefully, so I don't lose progress on large files when temporary errors occur.

**Why this priority**: API calls can fail due to rate limits, network issues, or service outages. Robust error handling prevents frustrating data loss.

**Independent Test**: Simulate an API failure mid-translation. The tool logs the error, marks the row as failed, and continues with remaining rows.

**Acceptance Scenarios**:

1. **Given** an API error occurs on row 25 of 100, **When** the error is caught, **Then** the tool logs the error, leaves that row's translated_value empty (or marks it as "ERROR"), and continues to row 26
2. **Given** multiple consecutive API failures, **When** failures exceed a threshold (e.g., 5 in a row), **Then** the tool pauses and prompts user to retry or abort
3. **Given** translation completes with some failures, **When** the output is written, **Then** a summary indicates how many rows failed and which keys they were

---

### User Story 4 - Resume Incomplete Translations (Priority: P3)

As a user who had translation interrupted, I want to resume from where I left off, so I don't waste API calls re-translating already completed rows.

**Why this priority**: For very large files or paid API usage, re-running the entire file is costly. This story optimizes for efficiency but is not essential for MVP.

**Independent Test**: Run translation, interrupt it, then run again on the same output file. Only untranslated rows are sent to the API.

**Acceptance Scenarios**:

1. **Given** an output CSV already has 30 of 100 rows translated, **When** user runs translate command pointing to that file as input, **Then** only the 70 empty rows are translated
2. **Given** a row has translated_value of "ERROR", **When** running in resume mode, **Then** that row is re-attempted

---

### Edge Cases

- **Empty CSV**: CSV contains only headers with no data rows → Tool exits with message "No translations to process"
- **Missing required columns**: CSV lacks one of the required columns → Clear error message listing expected columns
- **Invalid CSV format**: File is not valid CSV → Error message indicating parsing failure
- **Empty source_value**: A row has an empty source_value → Skip row and log warning
- **Very long source text**: source_value exceeds typical translation length → Still attempt translation; model handles truncation if needed
- **Rate limiting**: API returns 429 rate limit errors → Implement exponential backoff retry
- **Invalid API key**: OpenAI API key is invalid or missing → Clear error message before processing begins
- **Special characters in translation**: Translation contains quotes, commas, newlines → Properly escape in output CSV

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST be invoked via `aitranslate translate <csv>` subcommand
- **FR-001a**: Existing extraction functionality MUST be moved to `aitranslate extract <repo-path>` subcommand
- **FR-001b**: System MUST accept a CSV file path as the primary argument to the translate subcommand
- **FR-002**: System MUST read CSV files with columns: translation_key, source_value, source_language, target_language, code_context, translation_context
- **FR-003**: System MUST use OpenAI API with model GPT-5.1 for translations
- **FR-004**: System MUST provide all available context to the AI for each translation, including:
  - source_value (the text to translate)
  - source_language and target_language
  - code_context (JSON array of code snippets showing usage)
  - translation_context (JSON array of prior translation examples for nouns)
- **FR-005**: System MUST construct prompts that instruct the AI to use code context for understanding usage and translation context for terminology consistency
- **FR-006**: System MUST output a CSV file with all original columns plus a new "translated_value" column
- **FR-007**: System MUST preserve original column order and add translated_value as the last column
- **FR-008**: System MUST properly escape CSV special characters in the translated_value column
- **FR-009**: System MUST support specifying output file path via `--output` CLI argument (defaults to input filename with `-translated` suffix)
- **FR-010**: System MUST display real-time progress in TUI showing current row / total rows
- **FR-011**: System MUST read the OpenAI API key from environment variable `OPENAI_API_KEY`
- **FR-012**: System MUST validate API key presence before processing and provide clear error if missing
- **FR-013**: System MUST handle API errors gracefully by logging failures and continuing with remaining rows
- **FR-014**: System MUST implement exponential backoff retry for rate limit errors (429 responses)
- **FR-015**: System MUST abort after 5 consecutive API failures with summary of progress
- **FR-016**: System MUST skip rows that already have a non-empty translated_value (resume capability)
- **FR-017**: System MUST provide a `--force` flag to re-translate all rows regardless of existing translated_value
- **FR-018**: System MUST log translation failures with the translation_key for easy identification
- **FR-019**: System MUST process translations in parallel with a default concurrency limit of 5 simultaneous API calls
- **FR-020**: System MUST support `--concurrency <N>` CLI argument to override the default parallel request limit
- **FR-021**: System MUST write output CSV incrementally after each row translation completes (not only at end)
- **FR-022**: System MUST display a warning that code context will be sent to OpenAI before processing begins
- **FR-023**: System MUST require user confirmation (y/N prompt) to proceed after displaying the code context warning
- **FR-024**: System MUST support `--yes` or `-y` flag to skip confirmation prompt (for scripted/CI usage)
- **FR-025**: System MUST preserve original CSV row order in output regardless of parallel completion order

### Key Entities

- **TranslationRow**: A single row from the input CSV containing translation_key, source_value, source_language, target_language, code_context (JSON), translation_context (JSON), and optionally translated_value
- **TranslationPrompt**: The constructed prompt sent to the AI containing all context for a single translation request
- **TranslationResult**: The AI response containing the translated text or error information

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tool successfully translates 100% of rows (excluding intentionally skipped rows with errors)
- **SC-002**: Output CSV is valid and parseable by standard spreadsheet applications
- **SC-003**: Translations maintain consistency with prior translations when translation_context provides examples
- **SC-004**: API failures do not cause data loss—partial progress is preserved in output file
- **SC-005**: Translation of 100 rows completes within reasonable time (dependent on API response times)
- **SC-006**: Progress display updates at least once per completed translation

## Clarifications

### Session 2025-11-29

- Q: Should API calls be sequential or parallel? → A: Parallel with default concurrency limit of 5
- Q: How should CLI be structured? → A: Subcommand `aitranslate translate <csv>`; existing functionality moves to `aitranslate extract`
- Q: When should output file be written? → A: Incrementally after each row completes
- Q: How to handle sensitive data sent to OpenAI? → A: Warn that code context is sent to OpenAI, require user confirmation (y/N); add --yes flag to skip
- Q: Should output preserve original row order with parallel processing? → A: Yes, preserve original CSV row order
- Q: How to integrate with OpenAI? → A: Use OpenAI SDK with Responses API, XML-formatted prompts, JSON schema output enforcement
- Q: What JSON response schema? → A: Minimal schema `{translated_value: string}` only
- Q: What model parameters? → A: GPT-5.1 with `reasoning_effort: "low"`; no temperature or max_tokens (unsupported by this model)
- Q: How to handle CSV parsing/writing? → A: Use `fast-csv` library for both reading and writing; also refactor existing csv-writer.ts to use fast-csv

## Assumptions

- User has a valid OpenAI API key with access to the specified model
- Input CSV was generated by the aitranslate extraction command (feature 001)
- The code_context and translation_context columns contain valid JSON
- API rate limits will not prevent completion of reasonably-sized files (hundreds of rows)
- Users accept that AI translations may require human review for quality assurance
