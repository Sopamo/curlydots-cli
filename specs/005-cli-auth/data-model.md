# Data Model: CLI Authentication and Translation Push

**Feature**: CLI Authentication and Translation Push  
**Date**: 2025-12-19  
**Status**: Phase 1 Design Complete

## Core Entities

### AuthenticationToken

Represents a user's authenticated session with the backend.

**Fields**:
- `id`: string - Unique token identifier
- `accessToken`: string - JWT or opaque access token
- `refreshToken`: string - Token for automatic renewal
- `expiresAt`: Date - Token expiration timestamp
- `scope`: string[] - Token permissions/scopes
- `userId`: string - Backend user identifier
- `createdAt`: Date - When token was issued
- `lastUsedAt`: Date - Last token usage timestamp

**Validation Rules**:
- `accessToken` and `refreshToken` are required and non-empty
- `expiresAt` must be in the future when token is active
- `scope` array must contain at least one permission
- Token length must be between 32 and 4096 characters

**State Transitions**:
- `active` → `expired` (when expiresAt reached)
- `active` → `revoked` (user logout)
- `expired` → `active` (via refresh token renewal)

### TranslationValue

Represents a single translation string with its key and translated text.

**Fields**:
- `key`: string - Translation key/identifier
- `value`: string - Translated text content
- `locale`: string - Target language/locale code
- `namespace`: string - Translation grouping/namespace
- `metadata`: object - Additional translation metadata

**Validation Rules**:
- `key` and `value` are required and non-empty
- `key` must match pattern: `^[a-zA-Z0-9._-]+$`
- `locale` must be valid ISO 639-1/2 language code
- `value` length must be between 1 and 10000 characters

### TranslationContext

Represents contextual information for translation values.

**Fields**:
- `file`: string - Source file path
- `line`: number - Line number in source file
- `function`: string - Function/component name
- `usage`: string - Usage description or notes
- `tags`: string[] - Contextual tags
- `createdAt`: Date - When context was captured
- `updatedAt`: Date - Last context update

**Validation Rules**:
- `file` is required and must be valid path format
- `line` must be positive integer when present
- `usage` length must be less than 1000 characters
- `tags` array length must not exceed 20 items

### UserSession

Represents the current authentication state and stored credentials for the CLI instance.

**Fields**:
- `sessionId`: string - Unique session identifier
- `userId`: string - Backend user identifier
- `authMethod`: string - Authentication method used
- `tokenStorage`: string - Storage method (keychain, file, env)
- `isActive`: boolean - Whether session is currently active
- `lastActivity`: Date - Last user activity timestamp
- `deviceInfo`: object - Device/platform information

**Validation Rules**:
- `sessionId` and `userId` are required
- `authMethod` must be one of: 'browser', 'api_key', 'environment'
- `tokenStorage` must be one of: 'keychain', 'file', 'environment'
- `isActive` must be boolean

## Composite Data Structures

### TranslationEntry

Complete translation entry with value and context.

**Structure**:
```typescript
interface TranslationEntry {
  key: string;
  value: string;
  locale: string;
  namespace?: string;
  context?: TranslationContext;
  metadata?: Record<string, any>;
}
```

### TranslationPayload

Batch translation data for push operations.

**Structure**:
```typescript
interface TranslationPayload {
  translations: TranslationEntry[];
  metadata?: {
    source: string;
    version: string;
    timestamp: Date;
    totalCount: number;
  };
}
```

### AuthenticationResponse

Response from authentication flow.

**Structure**:
```typescript
interface AuthenticationResponse {
  success: boolean;
  token?: AuthenticationToken;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### PushResponse

Response from translation push operation.

**Structure**:
```typescript
interface PushResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: Array<{
    key: string;
    error: string;
  }>;
  metadata?: {
    requestId: string;
    timestamp: Date;
  };
}
```

## Data Relationships

### Entity Relationships

```
UserSession 1..1 AuthenticationToken
AuthenticationToken 0..1 TranslationPayload (authorization)
TranslationPayload 1..* TranslationEntry
TranslationEntry 0..1 TranslationContext
```

### Key Relationships

- **UserSession → AuthenticationToken**: One-to-one, session owns exactly one active token
- **TranslationEntry → TranslationContext**: Zero-to-one, context is optional for each entry
- **AuthenticationToken → TranslationPayload**: Zero-to-one, token authorizes push operations

## Storage Considerations

### Token Storage Strategy

**Primary**: OS Keychain
- macOS: Keychain Access
- Windows: Credential Manager  
- Linux: libsecret/GNOME Keyring

**Fallback**: Encrypted File
- Location: `~/.curlydots/tokens.json`
- Encryption: AES-256-GCM with device-specific key
- Permissions: 600 (user read/write only)

**CI/CD**: Environment Variables
- Variable: `CURLYDOTS_TOKEN`
- Format: Base64-encoded JSON token
- Scope: Process-only

### Data Persistence

**Configuration File**: `~/.curlydots/config.json`
```json
{
  "defaultLocale": "en",
  "apiEndpoint": "https://api.curlydots.com",
  "authMethod": "browser",
  "tokenStorage": "keychain"
}
```

**Session File**: `~/.curlydots/session.json`
```json
{
  "sessionId": "uuid-v4",
  "userId": "user-id",
  "lastActivity": "2025-12-19T20:00:00Z",
  "deviceInfo": {
    "platform": "darwin",
    "arch": "arm64",
    "version": "1.0.0"
  }
}
```

## Validation Schemas

### Token Validation

```typescript
const tokenSchema = {
  required: ['accessToken', 'refreshToken', 'expiresAt', 'userId'],
  properties: {
    accessToken: { type: 'string', minLength: 32, maxLength: 4096 },
    refreshToken: { type: 'string', minLength: 32, maxLength: 4096 },
    expiresAt: { type: 'string', format: 'date-time' },
    userId: { type: 'string', minLength: 1 },
    scope: { type: 'array', items: { type: 'string' } }
  }
};
```

### Translation Entry Validation

```typescript
const translationSchema = {
  required: ['key', 'value', 'locale'],
  properties: {
    key: { type: 'string', pattern: '^[a-zA-Z0-9._-]+$', maxLength: 255 },
    value: { type: 'string', minLength: 1, maxLength: 10000 },
    locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
    namespace: { type: 'string', maxLength: 100 },
    context: { $ref: '#/definitions/TranslationContext' }
  }
};
```

## Error Handling

### Validation Errors

- **Invalid Token**: Token format or content invalid
- **Expired Token**: Token expiration time passed
- **Missing Context**: Required context information missing
- **Invalid Locale**: Locale code not recognized
- **Duplicate Key**: Translation key already exists in namespace

### System Errors

- **Storage Error**: Keychain/file access failed
- **Network Error**: Backend communication failed
- **Authentication Error**: Token validation failed
- **Permission Error**: Insufficient token scope

## Security Considerations

### Token Security

- Tokens stored encrypted at rest
- Memory cleared after token usage
- Token validation on every API call
- Automatic token rotation when possible

### Data Protection

- Sensitive data never logged
- Temporary files cleaned up securely
- Environment variable scope limited
- File permissions restricted appropriately

### Privacy

- No personal data stored without consent
- User activity tracking minimal
- Data retention policies enforced
- Right to deletion supported
