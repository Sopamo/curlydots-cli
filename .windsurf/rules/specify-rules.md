# aitranslate Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-11-29

## Active Technologies
- TypeScript 5.x (strict mode) + Zustand (state), Ink (TUI - deferred), wink-nlp (noun detection), wink-eng-lite-web-model (English NLP model) (001-translation-context-analyzer)
- N/A (read-only analysis, CSV output) (001-translation-context-analyzer)
- TypeScript 5.x (strict mode) + Ink 5.x (TUI), React 18.x, Zustand 5.x (state), wink-nlp (NLP) (001-translation-context-analyzer)
- File-based (reads translation files, writes CSV) (001-translation-context-analyzer)
- TypeScript 5.x (strict mode) + OpenAI SDK (`openai`), Ink (TUI), Zustand (state), p-limit (concurrency) (002-csv-translation)
- CSV files (read/write via Bun APIs) (002-csv-translation)
- TypeScript 5.x (strict mode) + Bun.js built-in file APIs (no new dependencies needed) (003-reasoning-trace-logs)
- Text files on local filesystem (003-reasoning-trace-logs)
- TypeScript 5.x (Bun.js runtime) + fast-csv (existing), Bun file APIs (004-csv-import)
- File system (CommonJS translation modules) (004-csv-import)
- TypeScript 5.x (per constitution) + Bun.js runtime, OS keychain libraries, HTTP client (005-cli-auth)
- Encrypted local files + OS keychain + environment variables (005-cli-auth)
- TypeScript 5.x + Bun runtime, Zod, Ink, existing CLI auth + analyzer modules (001-push-translations)
- TypeScript 5.x (Bun runtime) + Bun, existing CLI extraction/analyzer modules (001-push-translations)
- N/A (file scanning + API requests) (001-push-translations)

- TypeScript 5.x (strict mode) + Ink (TUI), Zustand (state management), glob (file matching) (001-translation-context-analyzer)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 001-push-translations: Added TypeScript 5.x (Bun runtime) + Bun, existing CLI extraction/analyzer modules
- 001-push-translations: Added TypeScript 5.x + Bun runtime, Zod, Ink, existing CLI auth + analyzer modules
- 001-push-translations: Added TypeScript 5.x (strict) + Bun runtime, Ink, fast-csv, p-limit, zustand


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
