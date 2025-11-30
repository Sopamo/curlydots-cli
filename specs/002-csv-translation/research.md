# Research: CSV Translation with AI

**Feature**: 002-csv-translation  
**Date**: 2025-11-29

## Research Tasks

### 1. OpenAI Responses API

**Task**: Research OpenAI Responses API for structured output with JSON schema enforcement

**Decision**: Use `openai.responses.create()` with `text.format: { type: "json_schema", ... }`

**Rationale**: 
- The Responses API is OpenAI's newer API that supports structured outputs natively
- JSON schema enforcement guarantees valid JSON matching the defined schema
- Better error handling and retry semantics than chat completions
- TypeScript SDK provides full type safety

**Alternatives Considered**:
- Chat Completions API with `response_format: { type: "json_object" }` — less strict, no schema enforcement
- Function calling — adds complexity, designed for tool use not structured output

**Implementation Notes**:
```typescript
import OpenAI from 'openai';

const client = new OpenAI(); // Uses OPENAI_API_KEY env var

const response = await client.responses.create({
  model: "gpt-5.1",
  reasoning: { effort: "low" },
  input: xmlPrompt,
  text: {
    format: {
      type: "json_schema",
      name: "translation_response",
      schema: translationResponseSchema,
      strict: true
    }
  }
});
// Note: GPT-5.1 does not support temperature or max_tokens parameters
```

### 2. XML Prompt Structure

**Task**: Design XML format for translation prompts with context

**Decision**: Use semantic XML tags to separate context types

**Rationale**:
- XML provides clear delimiters that LLMs parse well
- Hierarchical structure matches the nested context data
- Easy to validate and debug
- Self-documenting structure

**Format**:
```xml
<translation_request>
  <source_language>en</source_language>
  <target_language>de</target_language>
  
  <text_to_translate>Show all users</text_to_translate>
  
  <code_context>
    <usage file="src/components/UserList.tsx" line="42">
      <snippet>
        <![CDATA[
        <Button onClick={handleShow}>
          {t('users.show_all')}
        </Button>
        ]]>
      </snippet>
    </usage>
  </code_context>
  
  <translation_context>
    <example noun="users">
      <source_key>users.delete_all</source_key>
      <source_value>Delete all users</source_value>
      <target_value>Alle Benutzer:innen löschen</target_value>
    </example>
  </translation_context>
  
  <instructions>
    Translate the text to the target language.
    Use code context to understand how the text is used (e.g., button label, heading, message).
    Use translation context to maintain terminology consistency with existing translations.
    Return ONLY the translated text, no explanations.
  </instructions>
</translation_request>
```

### 3. JSON Response Schema

**Task**: Define JSON schema for translation response

**Decision**: Minimal single-field schema

**Rationale**:
- Simplest possible schema reduces parsing complexity
- Single field means less token overhead in response
- Strict mode ensures no extra fields
- Confidence removed — unnecessary complexity for v1

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "translated_value": {
      "type": "string",
      "description": "The translated text in target language"
    }
  },
  "required": ["translated_value"],
  "additionalProperties": false
}
```

### 4. Concurrency Control

**Task**: Research parallel API request handling with rate limiting

**Decision**: Use `p-limit` for concurrency control with configurable limit

**Rationale**:
- `p-limit` is lightweight, well-tested, TypeScript-friendly
- Simple API: `const limit = pLimit(5); await limit(() => apiCall())`
- Works well with Promise.all for parallel execution
- Easy to expose via CLI flag

**Alternatives Considered**:
- Manual semaphore — more code, same result
- `bottleneck` — heavier, designed for rate limiting not just concurrency
- Native Promise.all with chunking — less flexible

### 5. Exponential Backoff Strategy

**Task**: Define retry strategy for rate limit (429) errors

**Decision**: Exponential backoff with jitter, max 3 retries per request

**Rationale**:
- Standard practice for API rate limiting
- Jitter prevents thundering herd on retry
- 3 retries balances reliability vs. delay

**Implementation**:
```typescript
const delays = [1000, 2000, 4000]; // ms, with ±20% jitter
const maxRetries = 3;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        const delay = delays[attempt] * (0.8 + Math.random() * 0.4);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### 6. Incremental CSV Writing

**Task**: Research incremental file writing for crash recovery

**Decision**: Rewrite full CSV on each completed row, maintaining row order

**Rationale**:
- CSV format doesn't support append-in-place for ordered rows
- Full rewrite is simple and atomic (write to temp, rename)
- With parallel processing, must buffer and sort before write
- Bun's file APIs are fast enough for this scale

**Implementation Approach**:
- Keep all rows in memory with status (pending/complete/error)
- On each completion, sort by original index and write full file
- Use atomic write (temp file + rename) to prevent corruption

### 7. CSV Parsing & Writing

**Task**: Research CSV parsing/writing options for Bun

**Decision**: Use `fast-csv` library for both reading and writing CSV files

**Rationale**:
- `fast-csv` is a mature, well-maintained library with TypeScript support
- Handles edge cases (quotes, escaping, newlines in fields) correctly
- Streaming API works well for large files
- Single library for both parse and format operations
- Will also refactor existing `csv-writer.ts` to use fast-csv for consistency

**Installation**:
```bash
bun add fast-csv
```

**Implementation Notes**:
```typescript
import { parse } from '@fast-csv/parse';
import { format } from '@fast-csv/format';
import { createReadStream, createWriteStream } from 'fs';

// Reading CSV
const rows: TranslationRow[] = [];
createReadStream(inputPath)
  .pipe(parse({ headers: true }))
  .on('data', (row) => rows.push(row))
  .on('end', () => processRows(rows));

// Writing CSV
const stream = format({ headers: true });
stream.pipe(createWriteStream(outputPath));
for (const row of rows) {
  stream.write(row);
}
stream.end();
```

**Migration**: Existing `src/services/csv-writer.ts` will be refactored to use `fast-csv` for consistency across the codebase.

## Summary

All research tasks resolved. Key decisions:
- OpenAI Responses API with JSON schema enforcement
- XML-formatted prompts with semantic structure
- `p-limit` for concurrency (default 5)
- Exponential backoff with jitter for retries
- Full CSV rewrite on each completion for crash recovery
- `fast-csv` for all CSV operations (reading and writing)
