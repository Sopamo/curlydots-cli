# Curlydots CLI

AI-powered CLI tool for translation management. Extract missing translations, translate using AI, and import translations back into your codebase.

## Features

- **Extract Missing Translations**: Compare source and target language files to identify untranslated keys with code context
- **AI Translation**: Translate missing keys using OpenAI GPT with code and translation context
- **Import Translations**: Import translated CSV back into your translation file structure *(coming soon)*
- **Code Context Collection**: Search codebase for usages of each missing key with surrounding code
- **Translation Context**: Find related translations to help AI understand terminology patterns
- **Pluggable Parsers**: Extensible architecture for different translation file formats

## Installation

```bash
# Clone the repository
git clone <repo-url> curlydots-cli
cd curlydots-cli

# Install dependencies (requires Bun.js)
bun install

# Run the CLI
bun run src/index.ts --help
```

## Usage

```bash
curlydots <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `auth login` | Browser-based authentication flow with long polling |
| `auth status` | Display stored authentication token metadata |
| `auth logout` | Revoke current token and clear secure storage |
| `translations push` | Push translation JSON payload with context |
| `translations status` | Check status of a push request |
| `extract` | Find missing translations with code context and export to CSV |
| `translate` | Translate a CSV file using AI (OpenAI) |
| `import` | Import translated CSV back into translation files |

### Global Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--version` | `-v` | Show version number |

---

## Extract Command

Find missing translations with code context and export to CSV.

```bash
aitranslate extract <repo-path> [options]
```

### Required Options

| Option | Short | Description |
|--------|-------|-------------|
| `--source <lang>` | `-s` | Source language code (e.g., "en") |
| `--target <lang>` | `-t` | Target language code (e.g., "de") |
| `--translations-dir <path>` | `-d` | Translations directory relative to repo root |

### Optional Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--parser <name>` | `-p` | `node-module` | Parser to use |
| `--extensions <list>` | `-e` | `.js,.ts,.jsx,.tsx,.vue,.svelte,.html` | File extensions to search for code context |
| `--output <path>` | `-o` | `missing-translations.csv` | Output CSV path |

### Examples

```bash
# Basic usage
aitranslate extract ./my-project -s en -t de -d src/translations

# Custom output path
aitranslate extract ./my-project -s en -t fr -d locales -o ./reports/missing-fr.csv

# Limit file extensions to search
aitranslate extract ./my-project -s en -t es -d i18n -e .vue,.ts
```

---

## Translate Command

Translate a CSV file using OpenAI. Requires `OPENAI_API_KEY` environment variable.

```bash
aitranslate translate <csv-file> [options]
```

### Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--output <path>` | `-o` | `<input>-translated.csv` | Output CSV path |
| `--concurrency <N>` | `-c` | `5` | Parallel API requests (1-20) |
| `--force` | `-f` | | Re-translate all rows (ignore existing translations) |
| `--yes` | `-y` | | Skip confirmation prompt |
| `--traces` | | | Enable reasoning trace logging |

### Examples

```bash
# Basic translation
aitranslate translate missing-translations.csv

# Custom output with higher concurrency
aitranslate translate input.csv --output translated.csv --concurrency 10

# Force re-translate all rows
aitranslate translate input.csv --force --yes

# Enable reasoning traces for debugging
aitranslate translate input.csv --traces
```

---

## Import Command

Import translated CSV back into your translation file structure. This completes the translation workflow by writing AI-translated values back to your translation files.

```bash
aitranslate import <csv-file> [options]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--translations-dir <path>` | `-d` | Translations directory (required) |
| `--parser <name>` | `-p` | Parser to use (default: node-module) |
| `--help` | `-h` | Show help message |

### Examples

```bash
# Import translations
aitranslate import translated.csv -d src/translations

# With explicit parser
aitranslate import translated.csv -d src/translations -p node-module
```

### Behavior

- **Merges with existing translations**: Existing keys not in the CSV remain unchanged
- **Creates missing files/directories**: New translation files are created as needed
- **Skips empty translations**: Rows with empty `translated_value` are skipped
- **Reports summary**: Shows files created/modified, keys imported, rows skipped

## Translation File Format

The `node-module` parser expects CommonJS module files:

```
translations/
├── en/
│   ├── generic.js    # module.exports = { key: "value" }
│   └── auth.js
└── de/
    ├── generic.js
    └── auth.js
```

Example translation file:

```javascript
// translations/en/generic.js
module.exports = {
  welcome: 'Welcome',
  settings: {
    title: 'Settings',
    notifications: 'Notifications',
  },
};
```

Nested keys are flattened: `settings.title`, `settings.notifications`

## Workflow

The typical translation workflow is:

1. **Extract** - Find missing translations and export to CSV with context
2. **Translate** - Use AI to translate the CSV (or translate manually)
3. **Import** - Import translated CSV back into your translation files

```bash
# Step 1: Extract missing translations
aitranslate extract ./my-app -s en -t de -d src/i18n -o missing.csv

# Step 2: Translate using AI
export OPENAI_API_KEY="your-key"
aitranslate translate missing.csv -o translated.csv

# Step 3: Import translations back (coming soon)
aitranslate import translated.csv -d src/i18n
```

## Output Format

### Extract Output CSV

CSV columns from the `extract` command:

| Column | Description |
|--------|-------------|
| `translation_key` | The missing key path (e.g., `generic.welcome`) |
| `source_value` | Original text in source language |
| `source_language` | Source language code |
| `target_language` | Target language code |
| `code_context` | JSON array of code snippets where the key is used |
| `translation_context` | JSON array of related translations for context |

### Translate Output CSV

The `translate` command adds one column to the CSV:

| Column | Description |
|--------|-------------|
| `translated_value` | AI-generated translation

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint
```

## Adding a Parser

1. Create `src/parsers/my-parser.ts`:

```typescript
import type { Parser } from '../types';

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

## License

MIT
