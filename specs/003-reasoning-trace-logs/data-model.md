# Data Model: LLM Reasoning Trace Logs

**Feature**: 003-reasoning-trace-logs  
**Date**: 2025-11-29  
**Updated**: 2025-11-30 (added cost tracking)

## Entities

### TraceConfig

Configuration for trace logging, passed through the translate command.

```typescript
interface TraceConfig {
  /** Whether trace logging is enabled */
  enabled: boolean;
  
  /** Base directory for trace output (same as CSV output dir) */
  outputDir: string;
  
  /** Timestamp for this run (used for subdirectory) */
  runTimestamp: string;
  
  /** Full path to trace directory: outputDir/reasoning-traces/runTimestamp/ */
  traceDir: string;
}
```

### ReasoningTrace

The content to be written to a trace file.

```typescript
interface ReasoningTrace {
  /** Translation key (e.g., "users.show_all") */
  translationKey: string;
  
  /** Original text being translated */
  sourceValue: string;
  
  /** Source language code */
  sourceLanguage: string;
  
  /** Target language code */
  targetLanguage: string;
  
  /** ISO 8601 timestamp when translation completed */
  timestamp: string;
  
  /** The LLM's reasoning content (may be empty) */
  reasoningContent: string;
  
  /** The final translated value */
  translatedValue: string;
  
  /** Code context - where the key is used in source code */
  codeContext: string;
  
  /** Translation context - how similar keys were translated */
  translationContext: string;
  
  /** Token usage and cost information */
  tokenUsage: TokenUsage;
}
```

### TokenUsage

Token usage and cost information from the API response.

```typescript
interface TokenUsage {
  /** Number of input tokens (prompt) */
  inputTokens: number;
  
  /** Number of output tokens (completion) */
  outputTokens: number;
  
  /** Number of reasoning tokens (chain-of-thought) */
  reasoningTokens: number;
  
  /** Total tokens (input + output) */
  totalTokens: number;
  
  /** Estimated cost in USD */
  estimatedCostUsd: number;
}
```

### TranslationResponseWithReasoning

Extended response from OpenAI that includes reasoning and usage.

```typescript
interface TranslationResponseWithReasoning {
  /** The translated text */
  translated_value: string;
  
  /** The reasoning trace from the model (optional) */
  reasoning: string;
  
  /** Token usage from the API response */
  usage: TokenUsage;
}
```

## State Extensions

### TranslateState additions

```typescript
interface TranslateState {
  // ... existing fields ...
  
  /** Trace configuration (null if disabled) */
  traceConfig: TraceConfig | null;
}
```

### TranslateConfig additions

```typescript
interface TranslateConfig {
  // ... existing fields ...
  
  /** Enable reasoning trace logging */
  traces: boolean;
}
```

## File Format

### Trace File Structure

Each `.txt` file follows this format:

```text
=== Translation Reasoning Trace ===
Key: {translationKey}
Source: "{sourceValue}"
Source Language: {sourceLanguage}
Target Language: {targetLanguage}
Timestamp: {timestamp}
Translated: "{translatedValue}"
=====================================

=== Cost ===
Input Tokens: {inputTokens}
Output Tokens: {outputTokens}
Reasoning Tokens: {reasoningTokens}
Total Tokens: {totalTokens}
Estimated Cost: ${estimatedCostUsd}

=== Code Context ===
{codeContext}

=== Translation Context ===
{translationContext}

=== Reasoning ===
{reasoningContent}
```

### Empty/Missing Reasoning

When no reasoning is available:

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
Input Tokens: 150
Output Tokens: 148
Reasoning Tokens: 128
Total Tokens: 298
Estimated Cost: $0.0015

=== Code Context ===
[No code context available]

=== Translation Context ===
[No translation context available]

=== Reasoning ===
[No reasoning trace available - model may not support reasoning output]
```

## Directory Structure

```text
output/
├── translations-translated.csv
└── reasoning-traces/
    └── 2025-11-29T14-30-00/
        ├── users.show_all.txt
        ├── users.title.txt
        ├── settings.theme.txt
        └── navigation.home.txt
```

## Validation Rules

| Field | Validation |
|-------|------------|
| translationKey | Non-empty string, sanitized for filename |
| sourceValue | Non-empty string |
| timestamp | Valid ISO 8601 format |
| reasoningContent | May be empty; placeholder used if missing |

## Relationships

```text
TranslateConfig.traces
       │
       ▼ (if true)
TraceConfig (created at run start)
       │
       ▼ (for each translation)
ReasoningTrace ──> TraceFile on disk
```
