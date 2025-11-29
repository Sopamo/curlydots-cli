# Quickstart: Translation Context Analyzer

**Date**: 2025-11-29  
**Branch**: `001-translation-context-analyzer`

## Prerequisites

- Bun.js installed (`curl -fsSL https://bun.sh/install | bash`)
- A repository with translation files in CommonJS module format

## Installation

```bash
# Clone and install
git clone <repo-url> aitranslate
cd aitranslate
bun install

# Make CLI available globally (optional)
bun link
```

## Basic Usage

### 1. Analyze Missing Translations

```bash
# Find English keys missing in German
aitranslate /path/to/your/project \
  --source en \
  --target de \
  --translations-dir src/translations
```

### 2. View Results

Output CSV file (`missing-translations.csv`):

| translation_key | source_language | target_language | context |
|-----------------|-----------------|-----------------|---------|
| generic.new_feature | en | de | [{...}] |
| auth.mfa.title | en | de | [{...}] |

### 3. Custom Output Location

```bash
aitranslate ./project -s en -t de -d locales -o ./reports/missing.csv
```

## Expected Translation File Structure

The `node-module` parser expects:

```
src/translations/
├── en/
│   ├── index.js         # Aggregates modules
│   ├── generic.js       # module.exports = { key: "value" }
│   └── auth.js
└── de/
    ├── index.js
    ├── generic.js
    └── auth.js
```

### Example Translation File

```javascript
// src/translations/en/generic.js
module.exports = {
  back: 'Back',
  save: 'Save',
  cancel: 'Cancel',
  settings: {
    title: 'Settings',
    notifications: 'Notifications',
  },
};
```

Keys are flattened: `generic.settings.title`, `generic.settings.notifications`

## Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `-s, --source` | Source language | `-s en` |
| `-t, --target` | Target language | `-t de` |
| `-d, --translations-dir` | Translations folder | `-d src/i18n` |
| `-p, --parser` | Parser to use | `-p node-module` |
| `-e, --extensions` | File types to search | `-e .vue,.ts` |
| `-o, --output` | Output CSV path | `-o missing.csv` |

## Development

### Run Tests

```bash
bun test
```

### Run with Watch Mode

```bash
bun run --watch src/index.ts -- ./test-repo -s en -t de -d translations
```

### Add a New Parser

1. Create `src/parsers/my-parser.ts`:

```typescript
import type { Parser } from './index';

export const myParser: Parser = {
  name: 'my-parser',
  async parse(langDir: string): Promise<Map<string, string>> {
    // Parse your format and return key-value map
    return new Map();
  },
};
```

2. Register in `src/parsers/index.ts`:

```typescript
import { myParser } from './my-parser';
registerParser(myParser);
```

3. Use: `--parser my-parser`

## Troubleshooting

### "Source language directory not found"

Ensure your translations directory has a subdirectory matching the source language code:

```bash
ls /your/project/src/translations/
# Should show: en/  de/  fr/  etc.
```

### "Unknown parser"

Check available parsers:

```bash
aitranslate --help
# PARSERS section lists available parsers
```

### Context shows "No usages found"

The key may be:
- Dynamically constructed (`t('key.' + variable)`)
- In a file type not being searched (add via `--extensions`)
- Actually unused (safe to remove from source)

## Next Steps

1. Review the `missing-translations.csv` output
2. Use the context snippets to understand how each key is used
3. Provide translations to your translators with full context
4. Re-run after adding translations to verify completion
