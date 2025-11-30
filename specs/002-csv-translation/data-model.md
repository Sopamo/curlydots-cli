# Data Model: CSV Translation with AI

**Feature**: 002-csv-translation  
**Date**: 2025-11-29

## Entities

### TranslationRow

Represents a single row from the input/output CSV file.

```typescript
interface TranslationRow {
  /** Original row index (0-based, for ordering) */
  index: number;
  
  /** Translation key path (e.g., "users.show_all") */
  translationKey: string;
  
  /** Original text in source language */
  sourceValue: string;
  
  /** Source language code (e.g., "en") */
  sourceLanguage: string;
  
  /** Target language code (e.g., "de") */
  targetLanguage: string;
  
  /** JSON string of UsageContext[] - code snippets where key is used */
  codeContext: string;
  
  /** JSON string of TranslationContextExample[] - prior translation examples */
  translationContext: string;
  
  /** AI-generated translation (empty until translated) */
  translatedValue: string;
  
  /** Processing status */
  status: 'pending' | 'processing' | 'complete' | 'error' | 'skipped';
  
  /** Error message if status is 'error' */
  errorMessage?: string;
  
}
```

### TranslationRequest

The structured request sent to OpenAI (maps to XML prompt).

```typescript
interface TranslationRequest {
  /** Text to translate */
  sourceValue: string;
  
  /** Source language code */
  sourceLanguage: string;
  
  /** Target language code */
  targetLanguage: string;
  
  /** Parsed code context for XML formatting */
  codeUsages: CodeUsage[];
  
  /** Parsed translation examples for XML formatting */
  translationExamples: TranslationExample[];
}

interface CodeUsage {
  filePath: string;
  lineNumber: number;
  snippet: string;
}

interface TranslationExample {
  noun: string;
  sourceKey: string;
  sourceValue: string;
  targetValue: string;
}
```

### TranslationResponse

The structured response from OpenAI (JSON schema enforced). Minimal single-field schema.

```typescript
interface TranslationResponse {
  /** The translated text */
  translated_value: string;
}
```

### TranslateState

Zustand store state for the translate command.

```typescript
interface TranslateState {
  /** All rows being processed */
  rows: TranslationRow[];
  
  /** Current processing status */
  status: 'idle' | 'confirming' | 'translating' | 'complete' | 'error' | 'aborted';
  
  /** Total rows to translate (excludes skipped) */
  totalToTranslate: number;
  
  /** Rows completed (success or error) */
  completedCount: number;
  
  /** Rows that failed */
  errorCount: number;
  
  /** Consecutive error counter (for abort threshold) */
  consecutiveErrors: number;
  
  /** Input file path */
  inputPath: string;
  
  /** Output file path */
  outputPath: string;
  
  /** Concurrency limit */
  concurrency: number;
  
  /** Force re-translate flag */
  force: boolean;
}
```

### TranslateConfig

CLI configuration for translate command.

```typescript
interface TranslateConfig {
  /** Input CSV file path */
  inputPath: string;
  
  /** Output CSV file path (default: input with -translated suffix) */
  outputPath: string;
  
  /** Parallel request limit (default: 5) */
  concurrency: number;
  
  /** Re-translate all rows regardless of existing value */
  force: boolean;
  
  /** Skip confirmation prompt */
  yes: boolean;
}
```

## State Transitions

### TranslationRow.status

```
pending ──┬──> processing ──┬──> complete
          │                 │
          │                 └──> error
          │
          └──> skipped (if translatedValue exists and !force)
```

### TranslateState.status

```
idle ──> confirming ──┬──> translating ──┬──> complete
                      │                  │
                      │                  └──> aborted (5 consecutive errors)
                      │
                      └──> idle (user declined)
```

## Validation Rules

### Input CSV

| Field | Required | Validation |
|-------|----------|------------|
| translation_key | Yes | Non-empty string |
| source_value | Yes | Non-empty string (skip row if empty with warning) |
| source_language | Yes | Non-empty string |
| target_language | Yes | Non-empty string |
| code_context | Yes | Valid JSON string (array) |
| translation_context | Yes | Valid JSON string (array) |
| translated_value | No | If present and non-empty, row skipped unless --force |

### Output CSV

Same columns as input, plus:
- `translated_value` column added as last column
- Original row order preserved
- All special characters properly escaped

## Relationships

```
TranslateConfig (CLI input)
       │
       ▼
TranslateState (runtime state)
       │
       ├──> TranslationRow[] (N rows)
       │           │
       │           ▼
       │    TranslationRequest (per row)
       │           │
       │           ▼
       │    TranslationResponse (from OpenAI)
       │
       ▼
CSV Output (final artifact)
```
