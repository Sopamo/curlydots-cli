# Technical Research: LLM Reasoning Trace Logs

**Feature**: 003-reasoning-trace-logs  
**Date**: 2025-11-29  
**Updated**: 2025-11-30

## Research Tasks

### 1. OpenAI API: How to extract reasoning from responses

**Decision**: Access reasoning summaries from `response.output` array items with `type === 'reasoning'`

**Rationale**: 
- OpenAI's Responses API returns reasoning as items in the `response.output` array
- Reasoning items have `type: "reasoning"` and a `summary` array
- **CRITICAL**: Must set `reasoning: { summary: "auto" }` or `"detailed"` to receive summary text
- Without the `summary` parameter, the reasoning item exists but `summary` array is empty

**Sources**:
- [OpenAI Cookbook: Reasoning Items](https://cookbook.openai.com/examples/responses_api/reasoning_items)
- [OpenAI Community: How to get reasoning summary](https://community.openai.com/t/how-to-get-reasoning-summary-using-gpt-5-mini-in-agent-sdk/1358227)

**Response Structure**:
```json
{
  "output": [
    {
      "id": "rs_xxx",
      "type": "reasoning",
      "summary": [
        { "text": "The reasoning summary text here..." }
      ]
    },
    {
      "id": "msg_xxx",
      "type": "message",
      "content": [{ "text": "Final output...", "type": "output_text" }]
    }
  ]
}
```

**Implementation Fix**:
```typescript
// Request - MUST include summary parameter
const response = await client.responses.create({
  model: 'gpt-5.1',
  reasoning: { effort: 'medium', summary: 'auto' },  // ADD summary: 'auto'
  input: prompt,
  text: { format: translationResponseFormat },
});

// Response - extract from output array
const reasoningItem = response.output?.find(
  (item: { type: string }) => item.type === 'reasoning'
);
const reasoningContent = (reasoningItem as { summary?: Array<{ text: string }> })
  ?.summary?.[0]?.text || '';
```

**Previous Bug**:
The original implementation tried to access `response.reasoning?.content` which does not exist.
The reasoning content is in `response.output[].summary[].text` for items with `type === 'reasoning'`.

**Alternatives Considered**:
- **Separate reasoning call**: Make a second API call for explanation — Rejected: doubles cost and latency
- **Streaming reasoning tokens**: More complex, requires different API usage — Rejected

---

### 2. OpenAI API: How to extract token usage and cost

**Decision**: Access token usage from `response.usage` object

**Source**: [OpenAI Cookbook: Reasoning Items](https://cookbook.openai.com/examples/responses_api/reasoning_items)

**Rationale**:
- OpenAI's Responses API returns usage information in `response.usage`
- Contains `input_tokens`, `output_tokens`, and `output_tokens_details.reasoning_tokens`
- Cost can be calculated using GPT-5.1 pricing

**Exact Response Usage Structure** (from OpenAI Cookbook):
```json
{
  "usage": {
    "input_tokens": 10,
    "input_tokens_details": {
      "cached_tokens": 0
    },
    "output_tokens": 148,
    "output_tokens_details": {
      "reasoning_tokens": 128
    },
    "total_tokens": 158
  }
}
```

**Key Insight**: Reasoning tokens are a **subset** of output tokens, not additional. In the example above:
- 10 input tokens
- 148 output tokens total (includes 128 reasoning + 20 visible output)
- Total: 158 tokens

**GPT-5.1 Pricing** (as of 2025):
- Input: $2.00 / 1M tokens
- Output: $8.00 / 1M tokens
- Reasoning tokens count as output tokens

**Cost Calculation**:
```typescript
function calculateCost(usage: { input_tokens: number; output_tokens: number }): number {
  const INPUT_COST_PER_MILLION = 2.00;
  const OUTPUT_COST_PER_MILLION = 8.00;
  
  const inputCost = (usage.input_tokens / 1_000_000) * INPUT_COST_PER_MILLION;
  const outputCost = (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MILLION;
  
  return inputCost + outputCost;
}
```

**Implementation**:
```typescript
// Extract usage from response
const usage = response.usage;
const tokenUsage: TokenUsage = {
  inputTokens: usage.input_tokens,
  outputTokens: usage.output_tokens,
  reasoningTokens: usage.output_tokens_details?.reasoning_tokens || 0,
  totalTokens: usage.total_tokens,
  estimatedCostUsd: calculateCost(usage),
};
```

---

## File System Operations

### Decision: Use Bun.write() for async file writes

**Rationale**: Bun's native file API is simple, fast, and doesn't require additional dependencies. Matches existing patterns in csv-writer.ts.

**Pattern**:
```typescript
await Bun.write(filePath, content);
```

**Alternatives considered**:
- **Node.js fs module**: Would work but violates constitution (Bun.js only)
- **Streaming writes**: Overkill for small text files (reasoning traces are typically <50KB)

---

## Filename Sanitization

### Decision: Replace invalid characters with underscore, truncate with hash suffix

**Rationale**: Translation keys may contain filesystem-invalid characters. Standard approach is to sanitize while maintaining recognizability.

**Implementation**:
```typescript
function sanitizeFilename(key: string): string {
  // Replace invalid chars
  let safe = key.replace(/[/\\:*?"<>|]/g, '_');
  
  // Handle very long keys (>200 chars)
  if (safe.length > 200) {
    const hash = createHash(key).substring(0, 8);
    safe = safe.substring(0, 191) + '_' + hash;
  }
  
  return safe + '.txt';
}
```

**Alternatives considered**:
- **Base64 encoding**: Makes filenames unreadable — Rejected
- **MD5 hash only**: Loses human-readability — Rejected
- **URL encoding**: Creates ugly `%XX` sequences — Rejected

---

## Timestamp Format

### Decision: ISO 8601 format with colons replaced for filesystem safety

**Rationale**: ISO 8601 is standard and sortable. Colons are replaced with dashes for Windows compatibility.

**Format**: `2025-11-29T14-30-00` (from `2025-11-29T14:30:00`)

**Alternatives considered**:
- **Unix timestamp**: Not human-readable — Rejected
- **Custom format**: Non-standard — Rejected

---

## Error Handling Strategy

### Decision: Log warning on trace write failure, continue translation

**Rationale**: Trace logging is supplementary. Translation success is primary; trace failures should not block or abort.

**Pattern**:
```typescript
try {
  await writeTrace(key, reasoning);
} catch (error) {
  console.warn(`Warning: Failed to write trace for ${key}: ${error.message}`);
  // Continue with translation
}
```

**Alternatives considered**:
- **Fail fast**: Abort on any write error — Rejected: too strict for supplementary feature
- **Silent ignore**: No warning — Rejected: user should know traces are missing
- **Retry logic**: Adds complexity for rare failure case — Rejected per YAGNI

---

## Summary

| Topic | Decision |
|-------|----------|
| Reasoning source | OpenAI `response.output[].summary[].text` with `reasoning.summary: 'auto'` |
| Token usage | OpenAI `response.usage` with `input_tokens`, `output_tokens`, `reasoning_tokens` |
| Cost calculation | GPT-5.1 pricing: $2/1M input, $8/1M output |
| File writes | `Bun.write()` async |
| Filename sanitization | Replace invalid chars, truncate with hash |
| Timestamp format | ISO 8601 filesystem-safe |
| Error handling | Warn and continue |
