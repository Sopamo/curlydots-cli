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
- Backend returns accepted/duplicate counts summary
- Non-zero exit code on auth or API failures after retries
