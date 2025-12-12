# Quickstart: CSV Import Command Implementation

**Feature**: 004-csv-import  
**Date**: 2024-11-30

## Overview

This guide outlines implementation order and key decisions for the CSV import command.

## Implementation Order

### Phase 1: Parser Interface Update

1. **Update `Parser` interface** in `src/types/index.ts`
   - Rename `parse()` → `export()`
   - Add `import()` method signature
   - Add `ParserImportResult` type

2. **Update `node-module` parser** in `src/parsers/node-module.ts`
   - Rename existing `parse()` → `export()`
   - Implement `import()` method:
     - Group translations by file name (first segment of key)
     - Read existing file content (or create new)
     - Merge translations using deep object merge
     - Write CommonJS module format

3. **Update extract command** in `src/commands/extract.ts`
   - Change `parser.parse()` → `parser.export()`

### Phase 2: Import Command

4. **Create import service** in `src/services/import-service.ts`
   - Read CSV using existing `csv-reader.ts`
   - Filter rows with empty `translated_value` (skip with warning)
   - Extract target language from first row (single language per CSV)
   - Build `Map<string, string>` of translation_key → translated_value
   - Call `parser.import(langDir, translations)` once
   - Return ImportResult summary

5. **Create import command** in `src/commands/import.ts`
   - Parse CLI arguments (`--parser`/`-p` with default: node-module)
   - Validate inputs (CSV exists, translations dir exists, parser valid)
   - Call import service with selected parser
   - Display summary

6. **Register import command** in `src/index.ts`
   - Add case for "import" in command router

## Key Implementation Details

### CommonJS Module Writing

The node-module parser must write files in this format:

```javascript
module.exports = {
  key1: 'value1',
  nested: {
    key2: 'value2',
  },
};
```

Use `JSON.stringify()` for the object, then wrap with `module.exports = ` and add trailing semicolon.

### Deep Merge Algorithm

When merging new translations into existing file:

```typescript
function deepMerge(existing: object, updates: object): object {
  const result = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

### Key to Object Path

Convert dot-notation key to nested object:

```typescript
function setNestedValue(obj: object, key: string, value: string): void {
  const parts = key.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = current[parts[i]] || {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}
```

## Test Strategy

### Unit Tests

- Parser `export()`: Verify reads existing files correctly (existing tests, rename)
- Parser `import()`: Verify writes files with correct format, merges correctly
- Import service: Verify grouping, filtering, result aggregation

### Integration Tests

- Full workflow: Extract → (manual edit CSV) → Import
- Verify imported translations appear in files
- Verify existing translations preserved
