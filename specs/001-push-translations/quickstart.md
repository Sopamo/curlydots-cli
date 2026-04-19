# Quickstart: Push Translations Command

## Prerequisites
- Bun installed
- Logged in via `curlydots auth login` (optional if using `--api-token`)
- Project translations available on disk

## Basic Usage

```bash
curlydots translations push \
  --repo <path> \
  --translations-dir <path> \
  --source <lang> \
  --parser <name>
```

`--repo` is the root folder of the app you want to scan.

`--translations-dir` is repeatable and points to a translation directory inside that repo. Use it once for a single location, or pass it multiple times if translations are split across multiple folders, for example: `--translations-dir src/locales --translations-dir packages/*/locales`.

`--source` is the source language folder/code inside each translations directory, for example `en`.

`--parser` should match how your translations are stored on disk.

Example:

```bash
curlydots translations push \
  --repo ./my-app \
  --translations-dir src/locales \
  --translations-dir packages/*/locales \
  --source en \
  --parser node-module
```

`--project` is optional if you already selected a project via `curlydots projects select`.

## Optional Flags

```bash
curlydots translations push \
  --project <uuid> \
  --repo <path> \
  --translations-dir <path> \
  --source <lang> \
  --parser <name> \
  --api-host https://curlydots.com \
  --api-token <token> \
  --extensions .js,.ts,.vue # optional; omit to scan all files
```

## Expected Output
- Summary of keys scanned, skipped, and uploaded
- Only new unique keys are uploaded
- Non-zero exit code on auth or API failures after retries
