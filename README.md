# AITranslate

CLI tool to analyze translation files, find missing translations, and collect code context.

## Features

- **Find Missing Translations**: Compare source and target language files to identify untranslated keys
- **Collect Code Context**: Search codebase for usages of each missing key with ±15 lines of surrounding code
- **CSV Export**: Output results in RFC 4180 compliant CSV format for spreadsheet compatibility
- **Pluggable Parsers**: Extensible architecture for different translation file formats

## Installation

```bash
# Clone the repository
git clone <repo-url> aitranslate
cd aitranslate

# Install dependencies (requires Bun.js)
bun install

# Run the CLI
bun run src/index.ts --help
```

## Usage

```bash
aitranslate <repo-path> [options]
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
| `--extensions <list>` | `-e` | `.js,.ts,.jsx,.tsx,.vue,.svelte,.html` | File extensions to search |
| `--output <path>` | `-o` | `missing-translations.csv` | Output CSV path |
| `--help` | `-h` | | Show help |
| `--version` | `-v` | | Show version |

### Examples

```bash
# Basic usage
aitranslate ./my-project -s en -t de -d src/translations

# Custom output path
aitranslate ./my-project -s en -t fr -d locales -o ./reports/missing-fr.csv

# Limit file extensions to search
aitranslate ./my-project -s en -t es -d i18n -e .vue,.ts
```

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

## Output Format

CSV with columns:
- `translation_key` - The missing key path
- `source_language` - Source language code
- `target_language` - Target language code  
- `context` - JSON array of code snippets where the key is used

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
