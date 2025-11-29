# Research: Translation Context Analyzer

**Date**: 2025-11-29  
**Branch**: `001-translation-context-analyzer`

## Technology Decisions

### 1. TUI Library: Ink

**Decision**: Use Ink for terminal user interface

**Rationale**:
- React-based component model familiar to most developers
- Built-in support for spinners, progress bars, and structured layouts
- Works well with Bun.js runtime
- Enables rich progress display during long analysis operations

**Alternatives Considered**:
- **blessed/blessed-contrib**: More powerful but complex, steeper learning curve
- **chalk + ora**: Simpler but lacks structured layouts
- **console.log**: Too basic for multi-step progress tracking

### 2. State Management: Zustand

**Decision**: Use Zustand for global configuration state

**Rationale**:
- Minimal API, single store pattern
- No boilerplate (unlike Redux)
- Works outside React components (accessible in parser functions)
- TypeScript-first with excellent type inference
- Tiny bundle size (~1KB)

**Alternatives Considered**:
- **Jotai**: Atomic model unnecessary for config state
- **Context + Props**: Prop drilling through parser chain is error-prone
- **Singleton module**: Less testable, harder to reset between runs

### 3. Parser Plugin Architecture

**Decision**: Each parser in separate file with common interface

**Rationale**:
- Clear separation of concerns
- Easy to add new parsers without modifying existing code
- Testable in isolation
- Registry pattern for dynamic parser selection

**Pattern**:
```typescript
// src/parsers/index.ts
export interface Parser {
  name: string;
  parse(langDir: string): Promise<Record<string, string>>;
}

const parsers = new Map<string, Parser>();

export function registerParser(parser: Parser): void {
  parsers.set(parser.name, parser);
}

export function getParser(name: string): Parser | undefined {
  return parsers.get(name);
}
```

### 4. Multi-Store Pattern

**Decision**: Separate Zustand stores per domain, each in its own file

**Rationale**:
- Clear separation of concerns (config vs analysis state)
- Each store independently testable
- Scales well as app grows (add new stores without modifying existing)
- Both vanilla (services) and React hook (UI) access patterns supported

**Pattern**:
```typescript
// src/stores/config.ts
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

interface ConfigState {
  repoPath: string;
  translationsDir: string;
  sourceLanguage: string;
  targetLanguage: string;
  parser: string;
  extensions: string[];
  outputPath: string;
  setConfig: (config: Partial<ConfigState>) => void;
}

export const configStore = createStore<ConfigState>((set) => ({
  repoPath: '',
  translationsDir: '',
  sourceLanguage: '',
  targetLanguage: '',
  parser: 'node-module',
  extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.html'],
  outputPath: 'missing-translations.csv',
  setConfig: (config) => set(config),
}));

// React hook for UI components
export const useConfigStore = <T>(selector: (state: ConfigState) => T) =>
  useStore(configStore, selector);

// src/stores/analysis.ts - similar pattern for analysis state
// src/stores/index.ts - re-exports all stores
```

**Access Patterns**:
```typescript
// In services (non-React):
import { configStore } from '../stores';
const config = configStore.getState();

// In UI components (React):
import { useConfigStore, useAnalysisStore } from '../stores';
const repoPath = useConfigStore((s) => s.repoPath);
const progress = useAnalysisStore((s) => s.progress);
```

### 5. UI Views Architecture

**Decision**: Separate view components in `ui/views/` folder

**Rationale**:
- Clear separation between app shell and individual views
- Easy to add new views without modifying existing code
- Each view can subscribe to relevant stores independently
- Supports future view expansion (settings, results, etc.)

**Pattern**:
```typescript
// src/ui/views/progress.tsx
import { Box, Text } from 'ink';
import { useAnalysisStore } from '../../stores';

export function ProgressView() {
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const currentKey = useAnalysisStore((s) => s.currentKey);
  
  return (
    <Box flexDirection="column">
      <Text>Status: {status}</Text>
      <Text>Progress: {progress}%</Text>
      <Text>Current: {currentKey}</Text>
    </Box>
  );
}

// src/ui/views/index.ts
export { ProgressView } from './progress';
// Future: export { ResultsView } from './results';
// Future: export { SettingsView } from './settings';

// src/ui/app.tsx
import { ProgressView } from './views';
// App root renders current view based on state
```

**Current Views**:
- `progress.tsx` - Shows analysis progress bar and current status

**Future Views** (not in MVP):
- `results.tsx` - Display analysis results before export
- `settings.tsx` - Configuration UI if needed

### 6. File Searching Strategy

**Decision**: Use Bun's native glob + file reading APIs

**Rationale**:
- Bun.glob() is fast and built-in
- Bun.file() for efficient file reading
- No external dependency needed for file operations

**Pattern**:
```typescript
import { Glob } from 'bun';

async function findFiles(dir: string, extensions: string[]): Promise<string[]> {
  const patterns = extensions.map(ext => `**/*${ext}`);
  const glob = new Glob(patterns.join(','));
  return Array.fromAsync(glob.scan({ cwd: dir }));
}
```

### 6. Context Extraction Algorithm

**Decision**: Line-based extraction with configurable window

**Rationale**:
- Simple to implement and understand
- ±15 lines provides sufficient context
- Cap at 10 snippets per key prevents CSV bloat

**Algorithm**:
1. Search file for key occurrence (literal string match)
2. Extract line number of match
3. Read lines [lineNum - 15, lineNum + 15]
4. Include file path and line number in context
5. Stop after 10 matches per key

### 7. CSV Escaping

**Decision**: RFC 4180 compliant CSV output

**Rationale**:
- Standard format readable by Excel, Google Sheets, LibreOffice
- Proper handling of quotes, commas, newlines in context

**Rules**:
- Wrap fields containing `,`, `"`, or newlines in double quotes
- Escape `"` as `""`
- Use CRLF line endings for maximum compatibility

### 8. Noun Detection: wink-nlp (NEW)

**Decision**: Use wink-nlp with wink-eng-lite-web-model for noun extraction

**Rationale**:
- Lightweight JavaScript NLP library (~500KB with model)
- Designed for Bun/Node.js environments
- Fast processing (10,000+ sentences/second)
- Accurate POS tagging for noun extraction
- No Python dependencies or external services

**Alternatives Considered**:
- **compromise.js**: Simpler but less accurate POS tagging
- **natural**: Heavier, less maintained
- **OpenAI API**: External dependency, cost per request, latency
- **spaCy (Python)**: Would require Python subprocess, adds complexity

**Usage Pattern**:
```typescript
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);

function extractNouns(text: string): string[] {
  const doc = nlp.readDoc(text);
  const nouns: string[] = [];
  
  doc.tokens().each((token) => {
    const pos = token.out(nlp.its.pos);
    if (pos === 'NOUN' || pos === 'PROPN') {
      nouns.push(token.out(nlp.its.normal)); // lowercase normalized form
    }
  });
  
  return [...new Set(nouns)]; // deduplicate
}

// Example:
extractNouns('Show all users'); // ['users']
extractNouns('Delete selected notifications'); // ['notifications']
```

**Noun Matching Strategy**:
- Normalize to lowercase for comparison
- Use stemming for singular/plural matching (e.g., "user" ↔ "users")
- wink-nlp provides `its.stem` for lemmatization

### 9. Test Fixture Strategy (NEW)

**Decision**: Multiple fixture files across different extensions

**Rationale**:
- Verify extension filtering works correctly
- Ensure all files in target directories are scanned
- Test that non-matching extensions are ignored
- Comprehensive coverage of real-world scenarios

**Fixture Structure**:
```
tests/fixtures/sample-repo/
├── translations/
│   ├── en/
│   │   ├── generic.js
│   │   └── index.js
│   └── de/
│       ├── generic.js
│       └── index.js
└── src/
    ├── App.vue           # Primary Vue component
    ├── components/
    │   └── Header.vue    # Secondary Vue component (should be found)
    ├── utils/
    │   └── helpers.ts    # TypeScript file (should be found)
    └── data/
        └── config.json   # JSON file (should NOT be found - extension not in default list)
```

## Dependencies Summary

| Package | Version | Purpose |
|---------|---------|---------|
| ink | ^5.0.0 | TUI components (deferred) |
| zustand | ^4.5.0 | State management |
| react | ^18.0.0 | Required by Ink (deferred) |
| wink-nlp | ^2.0.0 | NLP for noun detection |
| wink-eng-lite-web-model | ^2.0.0 | English language model |

**Note**: Bun provides built-in glob, file I/O, and CLI argument parsing.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large file handling | Stream-based reading, skip binary files |
| Regex DoS on malformed keys | Escape special regex characters |
| Memory with many keys | Process keys in batches if >10,000 |
| wink-nlp model loading time | Load model once at startup, reuse |
| Non-English source values | Document limitation, future: language detection |
