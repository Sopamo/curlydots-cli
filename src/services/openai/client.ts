/**
 * OpenAI Client Service
 *
 * Wrapper for OpenAI SDK using Responses API with GPT-5.1.
 */

import OpenAI from 'openai';
import type { TokenUsage, TranslationRequest } from '../../types';
import { calculateCost } from '../trace-writer';
import { buildTranslationPrompt } from './prompts';
import { translationResponseFormat } from './schemas';

/**
 * Extended translation response that includes reasoning trace and usage
 */
export interface TranslationResponseWithReasoning {
  /** The translated text */
  translated_value: string;

  /** The reasoning trace from the model (may be empty) */
  reasoning: string;

  /** Token usage and cost information */
  usage: TokenUsage;
}

let clientInstance: OpenAI | null = null;

/**
 * Create OpenAI client instance
 * @throws Error if OPENAI_API_KEY is not set
 */
export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
        'Please set it before running the translate command.',
    );
  }

  if (!clientInstance) {
    clientInstance = new OpenAI({ apiKey });
  }

  return clientInstance;
}

/**
 * Validate that API key is present
 * @throws Error if OPENAI_API_KEY is not set
 */
export function validateApiKey(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
        'Please set it before running the translate command.',
    );
  }
}

/**
 * Translate text using OpenAI Responses API
 * @param request - Translation request with context
 * @returns Translation response with translated_value and reasoning
 */
export async function translateText(
  request: TranslationRequest,
): Promise<TranslationResponseWithReasoning> {
  const client = createOpenAIClient();
  const prompt = buildTranslationPrompt(request);

  const response = await client.responses.create({
    model: 'gpt-5.1',
    reasoning: { effort: 'medium', summary: 'detailed' },
    input: prompt,
    text: {
      format: translationResponseFormat,
    },
  });

  // Parse the JSON response
  const outputText = response.output_text;

  if (!outputText) {
    throw new Error('OpenAI response did not contain output_text');
  }

  // Extract reasoning content from output array
  // Reasoning items have type: 'reasoning' with summary array
  const reasoningItem = (
    response.output as Array<{ type: string; summary?: Array<{ text: string }> }>
  )?.find((item) => item.type === 'reasoning');
  const reasoningContent = reasoningItem?.summary?.[0]?.text || '';

  try {
    const parsed = JSON.parse(outputText) as { translated_value: string };

    if (!parsed.translated_value) {
      throw new Error('Response missing translated_value field');
    }

    // Extract token usage from response
    const responseUsage = response.usage as {
      input_tokens: number;
      output_tokens: number;
      output_tokens_details?: { reasoning_tokens?: number };
      total_tokens: number;
    };

    const usage: TokenUsage = {
      inputTokens: responseUsage.input_tokens,
      outputTokens: responseUsage.output_tokens,
      reasoningTokens: responseUsage.output_tokens_details?.reasoning_tokens || 0,
      totalTokens: responseUsage.total_tokens,
      estimatedCostUsd: calculateCost(responseUsage.input_tokens, responseUsage.output_tokens),
    };

    return {
      translated_value: parsed.translated_value,
      reasoning: reasoningContent,
      usage,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${outputText}`);
    }
    throw error;
  }
}

/**
 * Reset the client instance (for testing)
 */
export function resetClient(): void {
  clientInstance = null;
}
