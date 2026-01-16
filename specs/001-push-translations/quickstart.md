# Quickstart: Push Translations Command

## Prerequisites
- Bun installed
- Logged in via `aitranslate login` (optional if using `--api-token`)
- Project translations available on disk

## Basic Usage

```bash
aitranslate translations push \
  --project <uuid> \
  --repo <path> \
  --translations-dir <path> \
  --source <lang> \
  --parser <name>
```

## Optional Flags

```bash
aitranslate translations push \
  --project <uuid> \
  --repo <path> \
  --translations-dir <path> \
  --source <lang> \
  --parser <name> \
  --api-host https://curlydots.com \
  --api-token <token> \
  --extensions .js,.ts,.vue
```

## Expected Output
- Summary of keys scanned, skipped, and uploaded
- Non-zero exit code on auth or API failures
