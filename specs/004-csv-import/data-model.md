# Data Model: CSV Import Command

**Feature**: 004-csv-import  
**Date**: 2024-11-30

## Entities

### TranslationMap

Key→value pairs passed from import-service to parser.

| Type | Description |
|------|-------------|
| `Map<string, string>` | Full dot-notation key → translated value |

**Example**:
```
Map {
  "generic.welcome" => "Willkommen",
  "generic.goodbye" => "Auf Wiedersehen",
  "auth.login.button" => "Anmelden"
}
```

**Note**: CSV contains single target language, so no language field needed in the map. The target language directory is passed separately to `parser.import(langDir, translations)`.

### ImportResult

Summary of import operation.

| Field | Type | Description |
|-------|------|-------------|
| `filesCreated` | `number` | New files created |
| `filesModified` | `number` | Existing files updated |
| `keysAdded` | `number` | New keys written |
| `keysUpdated` | `number` | Existing keys overwritten |
| `rowsSkipped` | `number` | Rows with empty translated_value |
| `errors` | `ImportError[]` | Non-fatal errors encountered |

### ImportError

Non-fatal error during import.

| Field | Type | Description |
|-------|------|-------------|
| `translationKey` | `string` | Key that failed |
| `reason` | `string` | Human-readable error message |

## Key Transformations

### Key Parsing

Translation keys follow the pattern: `<fileName>.<nestedPath>`.

| Input Key | File Name | Nested Path |
|-----------|-----------|-------------|
| `generic.welcome` | `generic` | `welcome` |
| `auth.login.button` | `auth` | `login.button` |
| `errors.validation.required` | `errors` | `validation.required` |

### Nested Object Construction

Nested paths are expanded into object hierarchy:

```
"login.button" → { login: { button: "value" } }
```

## State Transitions

```
CSV Rows → Filter (skip empty) → Build Map → parser.import() → Group by file → Merge & Write
   │              │                  │              │                 │
   ▼              ▼                  ▼              ▼                 ▼
TranslationRow  Valid rows    Map<key,value>   Per-file maps    ImportResult
```

**Responsibility split**:
- **Import-service**: CSV parsing, filtering, building Map
- **Parser**: Grouping by file, merging, writing in format-specific way
