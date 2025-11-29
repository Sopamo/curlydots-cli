# Data Model: Translation Context Analyzer

**Date**: 2025-11-29  
**Updated**: 2025-11-29  
**Branch**: `001-translation-context-analyzer`

**Changes**: 
- Added `TranslationContextExample`, renamed `UsageContext` to `CodeContext`, updated `MissingTranslation` and `CsvRow`
- Added TUI checklist state to Analysis Store with task completion tracking and progress bars

## Core Types

## Zustand Stores

Each store is in a separate file under `src/stores/`.

### Config Store (`stores/config.ts`)

Global configuration populated from CLI arguments.

```typescript
interface ConfigState {
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
  
  /** Actions */
  setConfig: (config: Partial<ConfigState>) => void;
  reset: () => void;
}
```

### Analysis Store (`stores/analysis.ts`)

Tracks analysis progress, task checklist completion, and results for TUI updates.

```typescript
/**
 * TUI Checklist Task identifier
 * Tasks are displayed and completed in this order
 */
type TaskId = 
  | 'find_source_keys'           // Task 1: Find source translation keys
  | 'find_target_keys'           // Task 2: Find target translation keys  
  | 'find_missing'               // Task 3: Find missing translations
  | 'find_code_context'          // Task 4: Find code usage context (has progress bar)
  | 'find_translation_context'   // Task 5: Find existing translation context (has progress bar)
  | 'export_csv';                // Task 6: Export CSV file

/**
 * Task completion state
 */
interface TaskState {
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

interface AnalysisState {
  /** Current analysis status (legacy, maps to active task) */
  status: AnalysisStatus;
  
  /** Ordered list of checklist tasks with completion state */
  tasks: TaskState[];
  
  /** Currently active task ID */
  activeTaskId: TaskId | null;
  
  /** Number of keys found in source language */
  sourceKeyCount: number;
  
  /** Number of keys found in target language */
  targetKeyCount: number;
  
  /** Number of missing translations found */
  missingCount: number;
  
  /** Current key being processed (for progress display) */
  currentKey: string;
  
  /** Current progress (0-100) - overall or active task */
  progress: number;
  
  /** Error message if status is 'error' */
  error: string | null;
  
  /** Actions */
  setStatus: (status: AnalysisStatus) => void;
  startTask: (taskId: TaskId) => void;
  completeTask: (taskId: TaskId) => void;
  setTaskProgress: (taskId: TaskId, processed: number, total: number) => void;
  setProgress: (current: number, total: number) => void;
  setCounts: (source: number, target: number, missing: number) => void;
  setCurrentKey: (key: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

type AnalysisStatus = 
  | 'idle'
  | 'parsing_source'
  | 'parsing_target'
  | 'comparing'
  | 'searching_context'
  | 'searching_translation_context'
  | 'writing_csv'
  | 'complete'
  | 'error';

/**
 * Default task list with labels (initialized on reset)
 */
const DEFAULT_TASKS: TaskState[] = [
  { id: 'find_source_keys', label: 'Find source translation keys', status: 'pending' },
  { id: 'find_target_keys', label: 'Find target translation keys', status: 'pending' },
  { id: 'find_missing', label: 'Find missing translations', status: 'pending' },
  { id: 'find_code_context', label: 'Find code usage context', status: 'pending', progress: 0, processed: 0, total: 0 },
  { id: 'find_translation_context', label: 'Find existing translation context', status: 'pending', progress: 0, processed: 0, total: 0 },
  { id: 'export_csv', label: 'Export CSV file', status: 'pending' },
];
```

**Task-to-Status Mapping**:

| TaskId | AnalysisStatus | Has Progress Bar |
|--------|----------------|------------------|
| `find_source_keys` | `parsing_source` | No |
| `find_target_keys` | `parsing_target` | No |
| `find_missing` | `comparing` | No |
| `find_code_context` | `searching_context` | **Yes** |
| `find_translation_context` | `searching_translation_context` | **Yes** |
| `export_csv` | `writing_csv` | No |

**Progress Bar Calculation** (FR-027):
```typescript
// For tasks with progress bars, calculate from processed/total:
progress = Math.round((processed / total) * 100);

// Example: 25 of 50 missing keys processed
setTaskProgress('find_code_context', 25, 50); // progress = 50%
```

### Store Index (`stores/index.ts`)

```typescript
// Re-export all stores for convenient access
export { useConfigStore, configStore } from './config';
export { useAnalysisStore, analysisStore } from './analysis';

// Vanilla store access (for non-React code)
// configStore.getState().repoPath
// analysisStore.getState().setProgress(5, 10)
```

### TranslationKey

Represents a single translation key with its value.

```typescript
interface TranslationKey {
  /** Full key path (e.g., "generic.welcome", "auth.login.button") */
  key: string;
  
  /** Translation value in the source language */
  value: string;
  
  /** Optional namespace/module (e.g., "generic", "auth") */
  namespace?: string;
}
```

### TranslationSet

Collection of translation keys for a specific language.

```typescript
interface TranslationSet {
  /** Language code (e.g., "en", "de") */
  language: string;
  
  /** Map of key path to translation value */
  keys: Map<string, string>;
}
```

### CodeContext (formerly UsageContext)

A code snippet showing where a translation key is used.

```typescript
interface CodeContext {
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
```

### TranslationContextExample

An example of how a noun was previously translated.

```typescript
interface TranslationContextExample {
  /** The noun that was matched */
  noun: string;
  
  /** The translation key containing the noun */
  sourceKey: string;
  
  /** The source language value containing the noun */
  sourceValue: string;
  
  /** The translated value in target language */
  targetValue: string;
}
```

### MissingTranslation

A translation key that exists in source but not target language.

```typescript
interface MissingTranslation {
  /** The translation key path */
  key: string;
  
  /** Source language code */
  sourceLanguage: string;
  
  /** Target language code */
  targetLanguage: string;
  
  /** Original value in source language */
  sourceValue: string;
  
  /** Code contexts where key is used (max 10) */
  codeContexts: CodeContext[];
  
  /** Translation examples for nouns in source value (max 10) */
  translationContexts: TranslationContextExample[];
}
```

### CsvRow

Output row format for CSV export.

```typescript
interface CsvRow {
  /** Translation key path */
  translation_key: string;
  
  /** Original value in source language */
  source_value: string;
  
  /** Source language code */
  source_language: string;
  
  /** Target language code */
  target_language: string;
  
  /** JSON-encoded array of code context snippets */
  code_context: string;
  
  /** JSON-encoded array of translation context examples */
  translation_context: string;
}
```

## Translation Context Service

Service for detecting nouns and finding translation examples using wink-nlp.

```typescript
interface TranslationContextService {
  /**
   * Extract nouns from a source value
   * @param text - Source translation value (e.g., "Show all users")
   * @returns Array of detected nouns (e.g., ["users"])
   */
  extractNouns(text: string): string[];
  
  /**
   * Find translation examples for nouns
   * @param nouns - Nouns to find examples for
   * @param sourceTranslations - All source language translations
   * @param targetTranslations - All target language translations
   * @param maxExamples - Maximum number of examples (default: 10)
   * @returns Array of translation context examples
   */
  findTranslationExamples(
    nouns: string[],
    sourceTranslations: Map<string, string>,
    targetTranslations: Map<string, string>,
    maxExamples?: number
  ): TranslationContextExample[];
}
```

### Noun Detection Rules

- Use wink-nlp with `wink-eng-lite-web-model` for English text
- Extract tokens with POS tag `NOUN` or `PROPN` (proper nouns)
- Normalize nouns to lowercase for matching
- Match both singular and plural forms (e.g., "user" matches "users")

### Example Prioritization (FR-018)

1. **First pass**: One example per distinct noun
2. **Second pass**: Additional examples for same nouns until 10 total

```typescript
// Pseudocode for prioritization
function findExamples(nouns: string[], maxExamples = 10): TranslationContextExample[] {
  const examples: TranslationContextExample[] = [];
  const usedKeys = new Set<string>();
  
  // Pass 1: One example per noun
  for (const noun of nouns) {
    if (examples.length >= maxExamples) break;
    const example = findFirstMatchingExample(noun, usedKeys);
    if (example) {
      examples.push(example);
      usedKeys.add(example.sourceKey);
    }
  }
  
  // Pass 2: Additional examples for same nouns
  for (const noun of nouns) {
    if (examples.length >= maxExamples) break;
    const additionalExamples = findAllMatchingExamples(noun, usedKeys);
    for (const example of additionalExamples) {
      if (examples.length >= maxExamples) break;
      examples.push(example);
      usedKeys.add(example.sourceKey);
    }
  }
  
  return examples;
}
```

## Parser Interface

All parsers must implement this interface.

```typescript
interface Parser {
  /** Unique parser identifier (e.g., "node-module") */
  name: string;
  
  /**
   * Parse translation files for a specific language
   * @param langDir - Path to language directory (e.g., "src/translations/en")
   * @returns Map of key paths to translation values
   */
  parse(langDir: string): Promise<Map<string, string>>;
}
```

### Node-Module Parser Specifics

For the `node-module` parser handling CommonJS exports:

```typescript
interface NodeModuleParserOptions {
  /** File pattern to match (default: "*.js") */
  filePattern: string;
  
  /** Whether to flatten nested objects (default: true) */
  flattenNested: boolean;
  
  /** Key separator for flattened keys (default: ".") */
  keySeparator: string;
}
```

**Expected File Structure**:
```
<translations-dir>/
├── en/
│   ├── index.js      # Aggregates all modules
│   ├── generic.js    # module.exports = { key: "value" }
│   └── auth.js       # module.exports = { login: { button: "Login" } }
└── de/
    ├── index.js
    ├── generic.js
    └── auth.js
```

**Key Flattening**:
- `{ login: { button: "Login" } }` → `"login.button": "Login"`
- Namespace derived from filename: `auth.js` → prefix `auth.`

## State Transitions

### Analysis Workflow

```
IDLE → LOADING_CONFIG → PARSING_SOURCE → PARSING_TARGET → 
COMPARING → SEARCHING_CONTEXT → WRITING_CSV → COMPLETE
```

```typescript
type AnalysisState = 
  | { status: 'idle' }
  | { status: 'loading_config' }
  | { status: 'parsing_source'; language: string }
  | { status: 'parsing_target'; language: string }
  | { status: 'comparing'; totalKeys: number }
  | { status: 'searching_context'; current: number; total: number }
  | { status: 'writing_csv'; path: string }
  | { status: 'complete'; missingCount: number; outputPath: string }
  | { status: 'error'; message: string };
```

## Validation Rules

### Config Validation

| Field | Rule |
|-------|------|
| repoPath | Must exist and be readable directory |
| translationsDir | Must exist relative to repoPath |
| sourceLanguage | Non-empty string, directory must exist |
| targetLanguage | Non-empty string, directory must exist |
| parser | Must be registered parser name |
| extensions | Non-empty array, each starting with `.` |
| outputPath | Parent directory must be writable |

### Key Validation

| Rule | Description |
|------|-------------|
| Non-empty | Key path cannot be empty string |
| Valid characters | Keys contain only `[a-zA-Z0-9._-]` |
| No leading/trailing dots | `.key` and `key.` are invalid |

## Relationships

```
Config (1) ──uses──> Parser (1)
         │
         └──produces──> TranslationSet (2: source + target)
                              │
                              └──compared to produce──> MissingTranslation (*)
                                                              │
                                                              └──contains──> UsageContext (0..10)
                                                              │
                                                              └──exported as──> CsvRow (*)
```
