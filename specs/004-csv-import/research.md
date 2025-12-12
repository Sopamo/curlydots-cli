# Research: CSV Import Command

**Feature**: 004-csv-import  
**Date**: 2024-11-30

## Parser Interface Redesign

### Decision
Rename `parse()` to `export()` and add new `import()` method to the Parser interface.

### Rationale
- **Semantic clarity**: `export` better describes extracting translations from files, `import` describes writing them back
- **Symmetry**: The two operations are inverses, naming should reflect this
- **Single responsibility**: Each parser handles one file format, CSV parsing is centralized

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Keep `parse()`, add `write()` | Naming asymmetry (parse/write vs export/import) |
| Separate reader/writer classes | Violates YAGNI, adds complexity without benefit |
| Parser handles CSV too | Duplicates CSV logic across parsers, violates DRY |

## Data Flow Architecture

### Decision
CSV parsing happens in command layer; parsers receive structured data.

### Rationale
- **Separation of concerns**: CSV format is independent of translation file format
- **Reuse**: Existing `csv-reader.ts` already handles CSV parsing
- **Testability**: Parsers can be tested with in-memory data structures

### Data Flow

```
[CSV File] → csv-reader → [TranslationRow[]] → import-service → Map<key,value> → parser.import() → [Translation Files]
```

**Key point**: The import-service extracts key→value pairs from CSV rows and passes a `Map<string, string>` to `parser.import()`. The parser never sees the CSV structure.

## Import Strategy

### Decision
Import-service builds key→value Map from CSV, parser groups by file and merges.

### Rationale
- **Single target language per CSV**: Extract command produces CSV for one source→target pair, so no language grouping needed
- **Parser receives Map<string,string>**: Separation of concerns - CSV parsing in service layer, file writing in parser
- **Parser groups by file internally**: Keys like `generic.welcome` and `generic.goodbye` go to same file
- Preserves existing translations not in CSV

### Algorithm

1. **Import-service**:
   a. Read CSV into TranslationRow[]
   b. Filter rows with empty `translated_value` (skip with warning)
   c. Extract target language from first row (all rows have same target)
   d. Build Map<string, string> of translation_key → translated_value
   e. Call `parser.import(langDir, translations)`
   f. Return summary

2. **Parser.import()**:
   a. Group keys by file name (first segment of dot-notation key)
   b. For each file:
      - Read existing content (or empty object if new)
      - Merge new translations (deep merge for nested keys)
      - Write file in parser-specific format
   c. Return files created/modified count

## File Creation Strategy

### Decision
Create directories and files as needed; use parser's native format.

### Rationale
- Matches user expectation: if a key is imported, its file should exist
- Follows convention: new files match existing format in the translations directory

## Error Handling

### Decision
Skip invalid rows with warnings; continue processing valid rows.

### Rationale
- User can review warnings and fix source data
- Partial imports are more useful than complete failures
- Matches existing translate command behavior
