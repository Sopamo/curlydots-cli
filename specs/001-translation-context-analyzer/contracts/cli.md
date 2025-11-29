# CLI Contract: Translation Context Analyzer

**Date**: 2025-11-29  
**Branch**: `001-translation-context-analyzer`

## Command Signature

```bash
aitranslate <repo-path> [options]
```

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<repo-path>` | string | Yes | Absolute or relative path to the repository root |

## Options

| Option | Short | Type | Required | Default | Description |
|--------|-------|------|----------|---------|-------------|
| `--source` | `-s` | string | Yes | - | Source language code (e.g., "en") |
| `--target` | `-t` | string | Yes | - | Target language code (e.g., "de") |
| `--translations-dir` | `-d` | string | Yes | - | Path to translations directory relative to repo root |
| `--parser` | `-p` | string | No | `node-module` | Parser to use for translation files |
| `--extensions` | `-e` | string | No | `.js,.ts,.jsx,.tsx,.vue,.svelte,.html` | Comma-separated list of file extensions to search |
| `--output` | `-o` | string | No | `missing-translations.csv` | Output CSV file path |
| `--help` | `-h` | flag | No | - | Show help message |
| `--version` | `-v` | flag | No | - | Show version number |

## Examples

### Basic Usage

```bash
# Analyze keelearning translations
aitranslate /home/user/projects/keelearning \
  --source en \
  --target de \
  --translations-dir src/translations

# Short form
aitranslate ./my-project -s en -t fr -d locales
```

### With Custom Options

```bash
# Custom parser and extensions
aitranslate ./project \
  --source en \
  --target es \
  --translations-dir i18n \
  --parser node-module \
  --extensions .vue,.ts \
  --output ./reports/missing-es.csv
```

### Help Output

```
aitranslate - Find missing translations with code context

USAGE:
  aitranslate <repo-path> [options]

ARGUMENTS:
  <repo-path>    Path to the repository to analyze

OPTIONS:
  -s, --source <lang>           Source language code (required)
  -t, --target <lang>           Target language code (required)
  -d, --translations-dir <path> Translations directory relative to repo (required)
  -p, --parser <name>           Parser to use [default: node-module]
  -e, --extensions <list>       File extensions to search [default: .js,.ts,.jsx,.tsx,.vue,.svelte,.html]
  -o, --output <path>           Output CSV path [default: missing-translations.csv]
  -h, --help                    Show this help message
  -v, --version                 Show version number

EXAMPLES:
  aitranslate ./my-app -s en -t de -d src/translations
  aitranslate /path/to/repo --source en --target fr --translations-dir locales --output report.csv

PARSERS:
  node-module    CommonJS module.exports files in <lang>/ folders
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - analysis complete, CSV written |
| 1 | Error - invalid arguments or missing required options |
| 2 | Error - repository path does not exist or not readable |
| 3 | Error - translations directory not found |
| 4 | Error - source or target language directory not found |
| 5 | Error - unknown parser specified |
| 6 | Error - output path not writable |
| 7 | Error - parser failed to read translation files |

## Output Format

### stdout (TUI)

During execution, Ink TUI displays:

```
🔍 Translation Context Analyzer

Repository: /home/user/projects/keelearning
Translations: src/translations
Source: en → Target: de
Parser: node-module

[████████████████████░░░░░░░░░░░░░░░░░░░░] 52%
Parsing translations... 

Found 847 keys in source (en)
Found 812 keys in target (de)
Missing: 35 keys

Searching for context...
[████████████████████████████░░░░░░░░░░░░] 71%
Processing: generic.new_feature (25/35)

✅ Complete!
Output: ./missing-translations.csv
35 missing translations with context exported
```

### stderr (Errors)

```
Error: Repository path does not exist: /invalid/path
Error: Unknown parser: json-flat (available: node-module)
Error: Source language directory not found: src/translations/en
```

### CSV Output

```csv
translation_key,source_value,source_language,target_language,code_context,translation_context
"generic.new_feature","New Feature","en","de","[{""filePath"":""/src/components/Home.vue"",""lineNumber"":45,""snippet"":""...""}]","[{""noun"":""feature"",""sourceKey"":""feature.title"",""sourceValue"":""Feature List"",""targetValue"":""Funktionsliste""}]"
"auth.mfa.setup_title","Setup MFA","en","de","[{""filePath"":""/src/views/Security.tsx"",""lineNumber"":123,""snippet"":""...""}]","[]"
```

**code_context JSON Structure**:
```json
[
  {
    "filePath": "/absolute/path/to/file.vue",
    "lineNumber": 45,
    "snippet": "line 30\nline 31\n...\nline 60",
    "snippetStartLine": 30,
    "snippetEndLine": 60
  }
]
```

**translation_context JSON Structure**:
```json
[
  {
    "noun": "users",
    "sourceKey": "admin.delete_users",
    "sourceValue": "Delete all users",
    "targetValue": "Alle Benutzer:innen löschen"
  }
]
```

## Validation Rules

### Argument Validation

1. `repo-path` must be an existing, readable directory
2. `--source` and `--target` must be non-empty strings
3. `--translations-dir` must exist relative to `repo-path`
4. `--parser` must be a registered parser name
5. `--extensions` must be comma-separated, each starting with `.`
6. `--output` parent directory must be writable

### Error Messages

| Scenario | Message |
|----------|---------|
| Missing required arg | `Error: Missing required option: --source` |
| Invalid repo path | `Error: Repository path does not exist: <path>` |
| Missing translations dir | `Error: Translations directory not found: <path>` |
| Missing language dir | `Error: Language directory not found: <lang>` |
| Unknown parser | `Error: Unknown parser: <name> (available: node-module)` |
| Parse failure | `Error: Failed to parse <file>: <reason>` |
