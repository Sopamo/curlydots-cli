# Implementation Plan: LLM Reasoning Trace Logs

**Branch**: `003-reasoning-trace-logs` | **Date**: 2025-11-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-reasoning-trace-logs/spec.md`

## Summary

Save LLM reasoning traces to text files for each translated key when `--traces` flag is enabled. Traces include:
- Metadata header (key, source, target language, timestamp, translated value)
- **Token usage and cost** (input, output, reasoning tokens + USD cost estimate)
- Code context and translation context
- Model's reasoning summary

## Technical Context

**Language/Version**: TypeScript 5.x (Bun.js runtime)  
**Primary Dependencies**: OpenAI SDK (Responses API)  
**Storage**: Plain text files in `reasoning-traces/<timestamp>/` directories  
**Testing**: Bun test (unit + integration)  
**Target Platform**: Linux/macOS CLI  
**Project Type**: Single CLI project  
**Performance Goals**: <5% overhead on translation time  
**Constraints**: Trace failures must not abort translations  
**Scale/Scope**: One trace file per translation key per run

## Constitution Check

*GATE: All gates pass ✅*

- ✅ Bun.js only (no Node.js fs promises)
- ✅ TypeScript-first with strict typing
- ✅ Test-first development (unit + integration tests)
- ✅ Minimal dependencies (uses existing OpenAI SDK)

## Project Structure

### Documentation (this feature)

```text
specs/003-reasoning-trace-logs/
├── plan.md              # This file
├── research.md          # OpenAI API research (usage, reasoning)
├── data-model.md        # ReasoningTrace, TraceConfig, TokenUsage
├── quickstart.md        # Usage guide
├── contracts/           # Trace file format template
└── tasks.md             # Implementation tasks
```

### Source Code

```text
src/
├── types/index.ts           # ReasoningTrace, TraceConfig, TokenUsage types
├── services/
│   ├── trace-writer.ts      # formatTrace, writeTrace, sanitizeFilename, calculateCost
│   └── openai/client.ts     # Extract reasoning + usage from response
└── commands/translate.ts    # --traces flag, writeTraceFile

tests/
├── unit/services/trace-writer.test.ts
└── integration/translate-traces.test.ts
```

## Implementation: Add Cost to Traces (2025-11-30)

### Research Finding

OpenAI Responses API returns token usage in `response.usage`:

```typescript
response.usage = {
  input_tokens: 10,
  input_tokens_details: { cached_tokens: 0 },
  output_tokens: 148,
  output_tokens_details: { reasoning_tokens: 128 },
  total_tokens: 158
}
```

**Key Insight**: Reasoning tokens are a **subset** of output tokens (not additional).

### Implementation Steps

1. **Update `TranslationResponseWithReasoning`** in `src/services/openai/client.ts`:
   - Add `usage: TokenUsage` field to return type

2. **Extract usage from response** in `translateText()`:
   ```typescript
   const usage = response.usage;
   return {
     translated_value: parsed.translated_value,
     reasoning: reasoningContent,
     usage: {
       inputTokens: usage.input_tokens,
       outputTokens: usage.output_tokens,
       reasoningTokens: usage.output_tokens_details?.reasoning_tokens || 0,
       totalTokens: usage.total_tokens,
       estimatedCostUsd: calculateCost(usage),
     },
   };
   ```

3. **Add `calculateCost()` function** in `src/services/trace-writer.ts`:
   ```typescript
   const GPT51_INPUT_COST_PER_MILLION = 2.00;
   const GPT51_OUTPUT_COST_PER_MILLION = 8.00;
   
   export function calculateCost(inputTokens: number, outputTokens: number): number {
     return (inputTokens / 1_000_000) * GPT51_INPUT_COST_PER_MILLION +
            (outputTokens / 1_000_000) * GPT51_OUTPUT_COST_PER_MILLION;
   }
   ```

4. **Update `formatTrace()`** to include Cost section

5. **Update types** in `src/types/index.ts` with `TokenUsage` interface
