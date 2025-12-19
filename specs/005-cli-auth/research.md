# Research: CLI Authentication and Translation Push

**Feature**: CLI Authentication and Translation Push  
**Date**: 2025-12-19  
**Status**: Phase 0 Research Complete

## OS Keychain Integration

**Decision**: Use platform-specific keychain libraries with fallback to encrypted file storage

**Rationale**: 
- Provides highest security for token storage
- Meets user expectation for secure credential management
- Supports cross-platform requirements (Windows, macOS, Linux)
- Fallback ensures CI/CD compatibility

**Libraries Researched**:
- **macOS**: Keychain API via Node.js keytar library
- **Windows**: Windows Credential Manager 
- **Linux**: libsecret/GNOME Keyring
- **Fallback**: Node.js built-in crypto with encrypted JSON file

**Alternatives Considered**:
- Plain text storage (rejected for security)
- Environment variables only (rejected for UX)
- Database storage (rejected for complexity)

## Browser-Based Authentication Flow

**Decision**: Implement long polling with pairing codes

**Rationale**:
- Eliminates manual token copying
- Works across all platforms
- Secure out-of-band authentication

**Flow Researched**:
1. CLI generates unique pairing code
2. Opens browser with auth URL + pairing code
3. User authenticates in browser
4. Backend signals completion via long polling
5. CLI receives token and stores securely

**Alternatives Considered**:
- OAuth2 device flow (similar but more complex)
- Manual token paste (poor UX)
- Username/password CLI prompts (security concerns)

## Long Polling Implementation

**Decision**: Use HTTP long polling with timeout and retry logic

**Rationale**:
- Real-time authentication feedback
- Efficient resource usage
- Proven reliability
- Simple implementation

**Technical Approach**:
- HTTP GET request with 60-120 second timeout
- Exponential backoff on failures
- Immediate response on auth completion
- Graceful degradation to polling if long polling fails

## JSON Translation Data Format

**Decision**: Standardized JSON structure with key-value pairs and context metadata

**Rationale**:
- Widely supported across ecosystems
- Human-readable and editable
- Extensible for future requirements
- Easy validation and parsing

**Schema Researched**:
```json
{
  "translations": [
    {
      "key": "string",
      "value": "string", 
      "context": {
        "file": "string",
        "line": "number",
        "usage": "string",
        "metadata": "object"
      }
    }
  ]
}
```

**Alternatives Considered**:
- CSV format (limited context support)
- YAML format (less common in APIs)
- XML format (verbose, complex)

## Token Lifetime and Renewal

**Decision**: 24-hour tokens with automatic silent renewal

**Rationale**:
- Balances security and usability
- Reduces authentication frequency
- Allows background renewal
- Industry standard practice

**Renewal Strategy**:
- Check token expiry 1 hour before expiration
- Attempt silent renewal using stored refresh token
- Fall back to interactive authentication if renewal fails
- Graceful handling of network issues

## Error Handling Strategy

**Decision**: Categorized error handling with retry logic for transient failures

**Rationale**:
- Better user experience through intelligent retries
- Clear guidance for different error types
- Prevents user frustration from temporary issues
- Maintains system reliability

**Error Categories**:
- **Transient**: Network timeouts, rate limits (retry with backoff)
- **Authentication**: Token expired, invalid credentials (re-auth)
- **Permanent**: Invalid data, permission denied (user action)
- **System**: Browser unavailable, keychain access (fallback guidance)

## CLI Command Structure

**Decision**: Subcommand structure following modern CLI patterns

**Rationale**:
- Logical grouping of related commands
- Improved discoverability
- Extensible for future features
- Follows user expectations from tools like git, docker

**Command Structure**:
```bash
curlydots auth login
curlydots auth status  
curlydots auth logout
curlydots translations push
curlydots translations status
```

**Alternatives Considered**:
- Flat structure (poor organization)
- Verb-first structure (less intuitive)
- Flag-based structure (complex for multiple actions)

## CI/CD Environment Support

**Decision**: Environment variable authentication with fallback options

**Rationale**:
- Essential for automated workflows
- No browser access in CI environments
- Secure credential injection
- Industry standard practice

**Implementation**:
- `CURLYDOTS_TOKEN` environment variable
- `--api-key` flag for direct token specification
- Graceful fallback to interactive mode when possible
- Clear error messages for missing credentials

## Cross-Platform Compatibility

**Decision**: Platform-specific implementations with unified interface

**Rationale**:
- Required by feature specification
- User experience consistency
- Leverages platform-native security
- Maintains maintainability

**Platform Considerations**:
- **Windows**: Windows Credential Manager, default browser detection
- **macOS**: Keychain Access, Safari/Chrome detection
- **Linux**: libsecret, xdg-open for browser, multiple keychain options

## Security Considerations

**Decision**: Defense-in-depth approach with multiple security layers

**Rationale**:
- Protects user credentials and data
- Prevents common attack vectors
- Meets enterprise security requirements
- Builds user trust

**Security Measures**:
- Encrypted local storage
- OS keychain integration
- HTTPS-only communication
- Token validation and scope checking
- Secure random pairing codes
- Memory cleanup after token use

## Performance Requirements

**Decision**: Optimize for user experience with specific performance targets

**Rationale**:
- User satisfaction depends on responsiveness
- Performance goals in specification
- Competitive with existing CLI tools
- Feasible with modern implementations

**Performance Targets**:
- Authentication: <60 seconds total
- Translation push: <10 seconds for 1MB data
- Token validation: <1 second
- Command startup: <2 seconds

## Testing Strategy

**Decision**: Comprehensive test coverage with multiple test types

**Rationale**:
- Constitution requires test-first development
- Critical for security-sensitive features
- Ensures cross-platform reliability
- Prevents regressions

**Test Types**:
- Unit tests for individual components
- Integration tests for authentication flows
- Contract tests for API interactions
- End-to-end tests for complete user journeys
- Security tests for token handling
