# Quickstart: LLM Reasoning Trace Logs

**Feature**: 003-reasoning-trace-logs  
**Date**: 2025-11-29

## Prerequisites

- Feature 002 (csv-translation) must be implemented
- Valid OPENAI_API_KEY environment variable
- A CSV file with translations to process

## Installation

No additional dependencies required. This feature uses Bun.js built-in file APIs.

## Usage

### Enable Trace Logging

Add the `--traces` flag to enable reasoning trace output:

```bash
aitranslate translate input.csv --traces
```

### Full Example

```bash
# Translate with traces enabled
aitranslate translate missing-translations.csv --traces --yes

# Output structure:
# ./missing-translations-translated.csv
# ./reasoning-traces/2025-11-29T14-30-00/
#   ├── users.show_all.txt
#   ├── users.title.txt
#   └── ...
```

### With Custom Output Path

```bash
aitranslate translate input.csv --output translations/output.csv --traces
# Traces will be in: translations/reasoning-traces/2025-11-29T14-30-00/
```

## CLI Reference

| Flag | Description |
|------|-------------|
| `--traces` | Enable reasoning trace logging (disabled by default) |

## Trace File Format

Each trace file is plain text with a header block, followed by cost, context sections, and reasoning:

```text
=== Translation Reasoning Trace ===
Key: users.show_all
Source: "Show all users"
Source Language: en
Target Language: de
Timestamp: 2025-11-29T14:30:00Z
Translated: "Alle Benutzer anzeigen"
=====================================

=== Cost ===
Input Tokens: 1250
Output Tokens: 148
Reasoning Tokens: 128
Total Tokens: 1398
Estimated Cost: $0.0042

=== Code Context ===
File: src/components/UserList.vue (line 42)
  <button @click="showAll">{{ t('users.show_all') }}</button>

=== Translation Context ===
users.title: "Users" → "Benutzer"
users.search: "Search users" → "Benutzer suchen"

=== Reasoning ===
The source text "Show all users" is a UI label, likely for a button
or link that displays a complete list of users. In German, I should
use "Alle Benutzer anzeigen" which:
- "Alle" = all
- "Benutzer" = users (gender-neutral form)
- "anzeigen" = to show/display

This is appropriate for a button context based on the code snippet
showing it's used in a Vue component's button element.
```

## Output Directory Structure

```text
<output-dir>/
├── <output-file>-translated.csv
└── reasoning-traces/
    └── <timestamp>/
        ├── <key-1>.txt
        ├── <key-2>.txt
        └── ...
```

## Error Handling

- **Trace write failure**: Warning logged, translation continues
- **Empty reasoning**: Placeholder message written to file
- **Invalid filename characters**: Automatically sanitized (replaced with `_`)

## Performance

- Trace logging adds <5% overhead to translation time
- Each trace file is written immediately after translation completes
- Parallel translations write to separate files (no locking needed)
