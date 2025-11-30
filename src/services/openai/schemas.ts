/**
 * OpenAI JSON Schema Definitions
 *
 * Schemas for structured output enforcement via OpenAI Responses API.
 */

/**
 * JSON Schema for translation response.
 * Minimal single-field schema for maximum simplicity.
 */
export const translationResponseSchema = {
  type: 'object' as const,
  properties: {
    translated_value: {
      type: 'string' as const,
      description: 'The translated text in the target language',
    },
  },
  required: ['translated_value'] as const,
  additionalProperties: false,
};

/**
 * Response format configuration for OpenAI Responses API text output.
 * Uses json_schema type with strict mode for guaranteed valid JSON.
 */
export const translationResponseFormat = {
  type: 'json_schema' as const,
  name: 'translation_response',
  schema: translationResponseSchema,
  strict: true,
};
