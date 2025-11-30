/**
 * Shared type definitions for AITranslate
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Global configuration populated from CLI arguments
 */
export interface Config {
  /** Absolute path to the repository root */
  repoPath: string;

  /** Path to translations directory relative to repoPath */
  translationsDir: string;

  /** Source language code (e.g., "en") */
  sourceLanguage: string;

  /** Target language code (e.g., "de") */
  targetLanguage: string;

  /** Parser name to use (e.g., "node-module") */
  parser: string;

  /** File extensions to search for context */
  extensions: string[];

  /** Output CSV file path */
  outputPath: string;
}

// ============================================================================
// Analysis State Types
// ============================================================================

/**
 * Current analysis status
 */
export type AnalysisStatus =
  | 'idle'
  | 'parsing_source'
  | 'parsing_target'
  | 'comparing'
  | 'searching_context'
  | 'searching_translation_context'
  | 'writing_csv'
  | 'complete'
  | 'error';

// ============================================================================
// TUI Task Types
// ============================================================================

/**
 * TUI Checklist Task identifier
 * Tasks are displayed and completed in this order
 */
export type TaskId =
  | 'find_source_keys'
  | 'find_target_keys'
  | 'find_missing'
  | 'find_code_context'
  | 'find_translation_context'
  | 'export_csv';

/**
 * Task completion state for TUI checklist
 */
export interface TaskState {
  /** Unique task identifier */
  id: TaskId;

  /** Display label for TUI */
  label: string;

  /** Completion status */
  status: 'pending' | 'in_progress' | 'complete';

  /** Progress percentage (0-100), only for tasks with progress bar */
  progress?: number;

  /** Number of items processed (for progress calculation) */
  processed?: number;

  /** Total items to process (for progress calculation) */
  total?: number;
}

// ============================================================================
// Translation Types
// ============================================================================

/**
 * Represents a single translation key with its value
 */
export interface TranslationKey {
  /** Full key path (e.g., "generic.welcome", "auth.login.button") */
  key: string;

  /** Translation value in the source language */
  value: string;

  /** Optional namespace/module (e.g., "generic", "auth") */
  namespace?: string;
}

/**
 * Collection of translation keys for a specific language
 */
export interface TranslationSet {
  /** Language code (e.g., "en", "de") */
  language: string;

  /** Map of key path to translation value */
  keys: Map<string, string>;
}

/**
 * A code snippet showing where a translation key is used (code_context)
 */
export interface UsageContext {
  /** Absolute file path where key was found */
  filePath: string;

  /** Line number where key appears (1-indexed) */
  lineNumber: number;

  /** Extracted code snippet (±15 lines around usage) */
  snippet: string;

  /** Start line of snippet (1-indexed) */
  snippetStartLine: number;

  /** End line of snippet (1-indexed) */
  snippetEndLine: number;
}

/**
 * An example of how a noun was previously translated (translation_context)
 */
export interface TranslationContextExample {
  /** The noun that was matched */
  noun: string;

  /** The translation key containing the noun */
  sourceKey: string;

  /** The source language value containing the noun */
  sourceValue: string;

  /** The translated value in target language */
  targetValue: string;
}

/**
 * A translation key that exists in source but not target language
 */
export interface MissingTranslation {
  /** The translation key path */
  key: string;

  /** Source language code */
  sourceLanguage: string;

  /** Target language code */
  targetLanguage: string;

  /** Original value in source language */
  sourceValue: string;

  /** Code contexts where key is used (max 10) */
  contexts: UsageContext[];

  /** Translation context examples for nouns (max 10) */
  translationContexts: TranslationContextExample[];
}

/**
 * Output row format for CSV export
 */
export interface CsvRow {
  /** Translation key path */
  translation_key: string;

  /** Source language code */
  source_language: string;

  /** Target language code */
  target_language: string;

  /** JSON-encoded array of context snippets */
  context: string;
}

// ============================================================================
// Translate Command Types (Feature 002)
// ============================================================================

/**
 * Row status for translation processing
 */
export type TranslationRowStatus = 'pending' | 'processing' | 'complete' | 'error' | 'skipped';

/**
 * Represents a single row from the input/output CSV file for translation
 */
export interface TranslationRow {
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
  status: TranslationRowStatus;

  /** Error message if status is 'error' */
  errorMessage?: string;
}

/**
 * Parsed code usage for XML prompt formatting
 */
export interface CodeUsage {
  filePath: string;
  lineNumber: number;
  snippet: string;
}

/**
 * Parsed translation example for XML prompt formatting
 */
export interface TranslationExample {
  noun: string;
  sourceKey: string;
  sourceValue: string;
  targetValue: string;
}

/**
 * The structured request sent to OpenAI (maps to XML prompt)
 */
export interface TranslationRequest {
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

/**
 * The structured response from OpenAI (JSON schema enforced)
 */
export interface TranslationResponse {
  /** The translated text */
  translated_value: string;
}

/**
 * Translate command status
 */
export type TranslateStatus =
  | 'idle'
  | 'confirming'
  | 'translating'
  | 'complete'
  | 'error'
  | 'aborted';

/**
 * Zustand store state for the translate command
 */
export interface TranslateState {
  /** All rows being processed */
  rows: TranslationRow[];

  /** Current processing status */
  status: TranslateStatus;

  /** Total rows to translate (excludes skipped) */
  totalToTranslate: number;

  /** Rows completed (success or error) */
  completedCount: number;

  /** Rows that failed */
  errorCount: number;

  /** Rows skipped (already translated) */
  skippedCount: number;

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

/**
 * CLI configuration for translate command
 */
export interface TranslateConfig {
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

  /** Enable reasoning trace logging */
  traces: boolean;
}

// ============================================================================
// Trace Logging Types (Feature 003)
// ============================================================================

/**
 * Configuration for trace logging
 */
export interface TraceConfig {
  /** Whether trace logging is enabled */
  enabled: boolean;

  /** Base directory for trace output (same as CSV output dir) */
  outputDir: string;

  /** Timestamp for this run (used for subdirectory) */
  runTimestamp: string;

  /** Full path to trace directory: outputDir/reasoning-traces/runTimestamp/ */
  traceDir: string;
}

/**
 * Token usage and cost information from the OpenAI API response
 */
export interface TokenUsage {
  /** Number of input tokens (prompt) */
  inputTokens: number;

  /** Number of output tokens (completion) */
  outputTokens: number;

  /** Number of reasoning tokens (subset of output tokens) */
  reasoningTokens: number;

  /** Total tokens (input + output) */
  totalTokens: number;

  /** Estimated cost in USD */
  estimatedCostUsd: number;
}

/**
 * The content to be written to a trace file
 */
export interface ReasoningTrace {
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

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Parser interface - all parsers must implement this
 */
export interface Parser {
  /** Unique parser identifier (e.g., "node-module") */
  name: string;

  /**
   * Parse translation files for a specific language
   * @param langDir - Path to language directory (e.g., "src/translations/en")
   * @returns Map of key paths to translation values
   */
  parse(langDir: string): Promise<Map<string, string>>;
}
