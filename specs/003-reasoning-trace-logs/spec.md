# Feature Specification: LLM Reasoning Trace Logs

**Feature Branch**: `003-reasoning-trace-logs`  
**Created**: 2025-11-29  
**Updated**: 2025-11-30  
**Status**: Complete ✅  
**Input**: User description: "For each translation key add a txt log file that contains the full reasoning traces of the LLM."

> **2025-11-30 Update**: Spec extended to include code context and translation context in trace files for complete debugging information.
>
> **2025-11-30 Update #2**: Spec extended to include LLM call cost (token usage) in trace files for cost tracking and optimization.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save Reasoning Traces to Log Files (Priority: P1)

As a developer reviewing AI translations, I want the full reasoning trace from the LLM saved to a text file for each translation key, so I can understand how the AI arrived at each translation decision and debug quality issues.

**Why this priority**: This is the core feature—capturing the LLM's thought process for transparency and debugging. Without this, there is no feature.

**Independent Test**: Run the translate command on a CSV file. After completion, a logs directory exists containing one `.txt` file per translation key with the full reasoning trace.

**Acceptance Scenarios**:

1. **Given** a CSV file with 5 translation keys, **When** user runs the translate command, **Then** 5 text files are created in a logs directory, one for each key
2. **Given** a translation key `users.show_all`, **When** translation completes, **Then** a file `users.show_all.txt` exists containing the LLM's reasoning trace
3. **Given** a translation with rich context, **When** the trace is saved, **Then** the file contains the complete reasoning text returned by the API
4. **Given** the translate command runs, **When** viewing the output directory, **Then** a `reasoning-traces/` subdirectory contains all trace files

---

### User Story 2 - Organize Traces by Translation Run (Priority: P2)

As a developer running multiple translation batches, I want reasoning traces organized by run timestamp, so I can compare reasoning across different translation attempts.

**Why this priority**: When iterating on translation quality or re-running failed translations, separating logs by run prevents confusion and enables comparison.

**Independent Test**: Run translate twice on the same file. Two separate timestamped directories exist, each with its own set of trace files.

**Acceptance Scenarios**:

1. **Given** a translate run at 14:30, **When** translation completes, **Then** traces are in `reasoning-traces/2025-11-29T14-30-00/`
2. **Given** a second run at 14:45, **When** translation completes, **Then** a new directory `reasoning-traces/2025-11-29T14-45-00/` exists with separate traces
3. **Given** the `--force` flag is used to re-translate, **When** complete, **Then** new trace files are created in a new timestamped directory

---

### Edge Cases

- **Empty reasoning trace**: If the API returns no reasoning content, create an empty file or file with a placeholder message
- **Translation error**: If a translation fails, still save whatever reasoning was captured before the error
- **Invalid filename characters**: Translation keys containing characters invalid for filenames (e.g., `/`, `\`, `:`) are sanitized (replaced with `_`)
- **Very long keys**: Keys exceeding filesystem limits are truncated with a hash suffix to ensure uniqueness
- **Disk full**: If disk space is exhausted, log a warning but continue translation (traces are supplementary)
- **Concurrent writes**: Multiple parallel translations write to separate files; no locking needed

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST save the LLM reasoning trace to a text file for each translated key
- **FR-002**: System MUST create a `reasoning-traces/` directory in the same location as the output CSV
- **FR-003**: System MUST name each trace file using the translation key with `.txt` extension
- **FR-004**: System MUST sanitize translation keys to create valid filenames (replace `/\:*?"<>|` with `_`)
- **FR-005**: System MUST organize traces into timestamped subdirectories (ISO 8601 format, filesystem-safe)
- **FR-006**: System MUST include metadata in each trace file using a labeled header block format (key, source value, languages, timestamp, translated value, code context, translation context, LLM cost), followed by the reasoning content
- **FR-011**: System MUST include the LLM API call cost in each trace file, showing input tokens, output tokens, reasoning tokens, and estimated cost in USD
- **FR-007**: System MUST write trace files immediately after each translation completes (not batched at end)
- **FR-008**: System MUST handle missing or empty reasoning traces gracefully (write placeholder message)
- **FR-009**: System MUST NOT fail the translation if trace file writing fails (log warning, continue)
- **FR-010**: System MUST support a `--traces` flag to enable trace logging (disabled by default)

### Key Entities

- **ReasoningTrace**: The text content of the LLM's reasoning process for a single translation, including metadata (key, source value, languages, timestamp, translated value, code context, translation context, LLM cost)
- **TokenUsage**: The token counts from the API response (input tokens, output tokens, reasoning tokens) and calculated cost
- **TraceFile**: A text file on disk containing one ReasoningTrace, named after the translation key

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful translations have a corresponding trace file created
- **SC-002**: Trace files are written within 1 second of translation completion
- **SC-003**: Trace file content includes the complete reasoning text from the API (no truncation)
- **SC-004**: Trace files are human-readable text format, viewable in any text editor
- **SC-005**: Trace logging adds less than 5% overhead to total translation time
- **SC-006**: Users can locate trace for any key by navigating to `reasoning-traces/<timestamp>/<key>.txt`

## Clarifications

### Session 2025-11-29

- Q: Should trace logging be enabled or disabled by default? → A: Disabled by default, `--traces` flag to enable
- Q: What format should trace files use? → A: Plain text with labeled header block (key, source value, languages, timestamp, translated value), then reasoning content

### Session 2025-11-30

- Q: Should trace files include the input context provided to the LLM? → A: Yes, include both code context (where the key is used) and translation context (how similar keys were translated) in the trace file for complete debugging information
- Q: Should trace files include the cost of each LLM call? → A: Yes, include token usage (input, output, reasoning) and estimated USD cost for cost tracking and optimization

## Assumptions

- The LLM API returns reasoning traces when using reasoning-enabled models with appropriate settings
- Reasoning traces are text content suitable for plain text file storage
- The filesystem supports the expected number of trace files (one per translation key)
- This feature extends the existing `aitranslate translate` command from feature 002
