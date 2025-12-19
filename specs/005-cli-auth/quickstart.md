# Quickstart Guide: CLI Authentication and Translation Push

**Feature**: CLI Authentication and Translation Push  
**Date**: 2025-12-19  
**Status**: Phase 1 Design Complete

## Overview

This guide provides step-by-step instructions for setting up and using the Curlydots CLI authentication and translation push functionality.

## Prerequisites

- Curlydots CLI installed
- Node.js/Bun.js runtime
- Internet connection for authentication
- Default web browser

## Installation

```bash
# Install CLI globally
bun install -g @curlydots/cli

# Or install locally
bun add @curlydots/cli
```

## Authentication Setup

### Interactive Authentication (Recommended)

```bash
# Start browser-based authentication
curlydots auth login
```

**Flow**:
1. CLI generates unique pairing code
2. Opens default browser to authentication page
3. Complete authentication in browser
4. CLI automatically receives and stores token

### CI/CD Environment Authentication

```bash
# Set environment variable
export CURLYDOTS_TOKEN="your-api-token-here"

# Or use API key flag
curlydots translations push --api-key="your-api-token-here"
```

## Translation Management

### Push Translation Data

```bash
# Push translations with context
curlydots translations push --file translations.json

# Push from stdin
cat translations.json | curlydots translations push

# Push with specific namespace
curlydots translations push --file translations.json --namespace "web-app"
```

### Translation Data Format

```json
{
  "translations": [
    {
      "key": "welcome.message",
      "value": "Welcome to our application!",
      "locale": "en",
      "namespace": "common",
      "context": {
        "file": "src/components/Header.tsx",
        "line": 42,
        "function": "Header",
        "usage": "Main welcome message displayed on homepage",
        "tags": ["ui", "welcome", "homepage"]
      }
    }
  ],
  "metadata": {
    "source": "cli-push",
    "version": "1.0",
    "timestamp": "2025-12-19T20:00:00Z",
    "totalCount": 1
  }
}
```

## Token Management

### Check Authentication Status

```bash
# Show current authentication status
curlydots auth status

# Output example:
# Status: Authenticated
# User: user_123456789
# Expires: 2025-12-20T20:00:00Z
# Storage: keychain
```

### Logout and Revoke Access

```bash
# Logout and remove stored tokens
curlydots auth logout

# Output example:
# Success: Token revoked successfully
```

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CURLYDOTS_TOKEN` | API authentication token | `sk_test_123456789` |
| `CURLYDOTS_API_URL` | Custom API endpoint | `https://api.staging.curlydots.com` |
| `CURLYDOTS_DEBUG` | Enable debug logging | `true` |

### Configuration File

Create `~/.curlydots/config.json`:

```json
{
  "defaultLocale": "en",
  "apiEndpoint": "https://api.curlydots.com",
  "authMethod": "browser",
  "tokenStorage": "keychain",
  "timeout": 30000,
  "retries": 3
}
```

## Common Workflows

### Initial Setup

```bash
# 1. Authenticate
curlydots auth login

# 2. Verify authentication
curlydots auth status

# 3. Push translations
curlydots translations push --file translations.json
```

### CI/CD Pipeline

```bash
#!/bin/bash
# ci-deploy.sh

# 1. Set authentication token
export CURLYDOTS_TOKEN="${CURLYDOTS_TOKEN}"

# 2. Verify authentication
curlydots auth status

# 3. Push translations
curlydots translations push --file translations.json --namespace "production"

# 4. Check push status
curl -H "Authorization: Bearer $CURLYDOTS_TOKEN" \
  "https://api.curlydots.com/v1/translations/status?request_id=req_123"
```

### Development Workflow

```bash
# 1. Extract translations from codebase
curlydots extract --src ./src --output translations.json

# 2. Review and edit translations
# Edit translations.json manually

# 3. Push to backend
curlydots translations push --file translations.json

# 4. Monitor push status
curlydots translations status --request-id req_123
```

## Troubleshooting

### Authentication Issues

**Problem**: Browser doesn't open
```bash
# Solution: Manual browser flow
curlydots auth login --manual
# Opens URL to copy manually
```

**Problem**: Token expired
```bash
# Solution: Re-authenticate
curlydots auth login
```

**Problem**: CI/CD authentication fails
```bash
# Solution: Verify environment variable
echo $CURLYDOTS_TOKEN
curlydots auth status
```

### Translation Push Issues

**Problem**: Invalid translation format
```bash
# Solution: Validate JSON
cat translations.json | jq .

# Or use CLI validation
curlydots translations validate --file translations.json
```

**Problem**: Payload too large
```bash
# Solution: Split into smaller batches
split -l 100 translations.json batch_
for file in batch_*; do
  curlydots translations push --file "$file"
done
```

**Problem**: Network timeout
```bash
# Solution: Increase timeout
curlydots translations push --file translations.json --timeout 60000
```

## Security Best Practices

### Token Security

- Never commit tokens to version control
- Use environment variables in CI/CD
- Rotate tokens regularly
- Revoke unused tokens

```bash
# Good: Environment variable
export CURLYDOTS_TOKEN="sk_test_123456789"

# Bad: Hardcoded token
curlydots translations push --api-key "sk_test_123456789"
```

### File Permissions

```bash
# Secure configuration file
chmod 600 ~/.curlydots/config.json

# Secure token file (if using file storage)
chmod 600 ~/.curlydots/tokens.json
```

## Performance Tips

### Large Translation Sets

```bash
# Use streaming for large files
cat large-translations.json | curlydots translations push --stream

# Increase batch size
curlydots translations push --file translations.json --batch-size 500
```

### Network Optimization

```bash
# Enable compression
curlydots translations push --file translations.json --compress

# Use parallel uploads
curlydots translations push --file translations.json --parallel 4
```

## API Reference

### Authentication Commands

| Command | Description | Options |
|---------|-------------|---------|
| `curlydots auth login` | Start authentication flow | `--manual`, `--timeout` |
| `curlydots auth status` | Show authentication status | `--format json` |
| `curlydots auth logout` | Revoke authentication | `--all` |

### Translation Commands

| Command | Description | Options |
|---------|-------------|---------|
| `curlydots translations push` | Push translation data | `--file`, `--namespace`, `--batch-size` |
| `curlydots translations status` | Check push status | `--request-id` |
| `curlydots translations validate` | Validate translation format | `--file`, `--strict` |

## Support

- **Documentation**: https://docs.curlydots.com/cli
- **Issues**: https://github.com/curlydots/curlydots-cli/issues
- **Community**: https://discord.gg/curlydots

## Next Steps

1. Complete initial authentication setup
2. Create your first translation file
3. Push translations to backend
4. Set up CI/CD integration
5. Explore advanced configuration options
