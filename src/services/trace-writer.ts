/**
 * Trace Writer Service
 *
 * Writes LLM reasoning traces to text files for debugging and quality review.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReasoningTrace, TraceConfig } from '../types';

/** Maximum filename length before truncation */
const MAX_FILENAME_LENGTH = 200;

/** Characters invalid in filenames (Windows + Unix) */
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/g;

/** GPT-5.1 pricing per million tokens */
const GPT51_INPUT_COST_PER_MILLION = 2.0;
const GPT51_OUTPUT_COST_PER_MILLION = 8.0;

/**
 * Calculate the estimated cost in USD for an API call
 * Based on GPT-5.1 pricing: $2/1M input, $8/1M output
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * GPT51_INPUT_COST_PER_MILLION;
  const outputCost = (outputTokens / 1_000_000) * GPT51_OUTPUT_COST_PER_MILLION;
  return inputCost + outputCost;
}

/**
 * Generate a filesystem-safe timestamp for directory naming
 * Format: YYYY-MM-DDTHH-MM-SS
 */
export function generateTimestamp(): string {
  const now = new Date();
  return now
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '');
}

/**
 * Sanitize a translation key to create a valid filename
 * - Replaces invalid characters with underscores
 * - Truncates long keys with hash suffix for uniqueness
 */
export function sanitizeFilename(key: string): string {
  // Replace invalid characters
  let safe = key.replace(INVALID_FILENAME_CHARS, '_');

  // Handle very long keys
  if (safe.length > MAX_FILENAME_LENGTH) {
    const hash = createHash('md5').update(key).digest('hex').substring(0, 8);
    safe = `${safe.substring(0, MAX_FILENAME_LENGTH - 9)}_${hash}`;
  }

  return `${safe}.txt`;
}

/**
 * Format a reasoning trace as plain text with header block, cost, and context sections
 */
export function formatTrace(trace: ReasoningTrace): string {
  const header = `=== Translation Reasoning Trace ===
Key: ${trace.translationKey}
Source: "${trace.sourceValue}"
Source Language: ${trace.sourceLanguage}
Target Language: ${trace.targetLanguage}
Timestamp: ${trace.timestamp}
Translated: "${trace.translatedValue}"
=====================================`;

  const { tokenUsage } = trace;
  const costSection = `=== Cost ===
Input Tokens: ${tokenUsage.inputTokens}
Output Tokens: ${tokenUsage.outputTokens}
Reasoning Tokens: ${tokenUsage.reasoningTokens}
Total Tokens: ${tokenUsage.totalTokens}
Estimated Cost: $${tokenUsage.estimatedCostUsd.toFixed(6)}`;

  const codeContext = trace.codeContext.trim() ? trace.codeContext : '[No code context available]';

  const translationContext = trace.translationContext.trim()
    ? trace.translationContext
    : '[No translation context available]';

  const reasoning = trace.reasoningContent.trim()
    ? trace.reasoningContent
    : '[No reasoning trace available - model may not support reasoning output]';

  return `${header}

${costSection}

=== Code Context ===
${codeContext}

=== Translation Context ===
${translationContext}

=== Reasoning ===
${reasoning}
`;
}

/**
 * Create trace configuration for a translation run
 */
export function createTraceConfig(outputDir: string): TraceConfig {
  const runTimestamp = generateTimestamp();
  const traceDir = join(outputDir, 'reasoning-traces', runTimestamp);

  return {
    enabled: true,
    outputDir,
    runTimestamp,
    traceDir,
  };
}

/**
 * Write a reasoning trace to a text file
 * Creates the trace directory if it doesn't exist
 */
export async function writeTrace(config: TraceConfig, trace: ReasoningTrace): Promise<void> {
  // Ensure trace directory exists
  if (!existsSync(config.traceDir)) {
    mkdirSync(config.traceDir, { recursive: true });
  }

  const filename = sanitizeFilename(trace.translationKey);
  const filePath = join(config.traceDir, filename);
  const content = formatTrace(trace);

  await Bun.write(filePath, content);
}
