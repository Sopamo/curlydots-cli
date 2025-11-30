/**
 * XML Prompt Builder for OpenAI Translation
 *
 * Builds structured XML prompts for translation requests.
 */

import type { TranslationRequest } from '../../types';

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build code context XML section
 */
function buildCodeContext(request: TranslationRequest): string {
  if (request.codeUsages.length === 0) {
    return '    <none>No code usages found for this translation key</none>';
  }

  return request.codeUsages
    .map(
      (usage) =>
        `    <usage file="${escapeXml(usage.filePath)}" line="${usage.lineNumber}">
      <snippet><![CDATA[${usage.snippet}]]></snippet>
    </usage>`,
    )
    .join('\n');
}

/**
 * Build translation context XML section
 */
function buildTranslationContext(request: TranslationRequest): string {
  if (request.translationExamples.length === 0) {
    return '    <none>No prior translation examples found for terms in this text</none>';
  }

  return request.translationExamples
    .map(
      (example) =>
        `    <example noun="${escapeXml(example.noun)}">
      <source_key>${escapeXml(example.sourceKey)}</source_key>
      <source_value>${escapeXml(example.sourceValue)}</source_value>
      <target_value>${escapeXml(example.targetValue)}</target_value>
    </example>`,
    )
    .join('\n');
}

/**
 * Build complete XML translation prompt
 * @param request - Translation request with all context
 * @returns XML-formatted prompt string
 */
export function buildTranslationPrompt(request: TranslationRequest): string {
  const codeContext = buildCodeContext(request);
  const translationContext = buildTranslationContext(request);

  return `<?xml version="1.0" encoding="UTF-8"?>
<translation_request>
  <source_language>${escapeXml(request.sourceLanguage)}</source_language>
  <target_language>${escapeXml(request.targetLanguage)}</target_language>
  
  <text_to_translate>${escapeXml(request.sourceValue)}</text_to_translate>
  
  <code_context>
${codeContext}
  </code_context>
  
  <translation_context>
${translationContext}
  </translation_context>
  
  <instructions>
    You are a professional translator. Translate the text from ${escapeXml(request.sourceLanguage)} to ${escapeXml(request.targetLanguage)}.
    
    Guidelines:
    1. Use the code_context to understand HOW the text is used (button label, heading, error message, etc.)
    2. Use the translation_context to maintain TERMINOLOGY CONSISTENCY with existing translations
    3. Preserve any placeholders like {name}, {{count}}, %s, etc. exactly as they appear
    4. Match the formality and style of the existing translations if examples are provided
    5. For UI elements (buttons, labels), prefer concise translations
    
    Return ONLY the translated text in the translated_value field.
  </instructions>
</translation_request>`;
}
