# Story 4.1: Implement Agent Enrollment with API Token

Status: review

## Story

As an **administrator**,
I want **to enroll a new agent using a registration token**,
So that **only authorized agents can connect to my organization**.

## Acceptance Criteria

1. **AC1** - Enrollment Request
   - Agent calls `/v1/agents/enroll` endpoint with registration token
   - Request includes: hostname, os_info, agent_version, machine_id
   - Bearer token authentication for enrollment endpoint

2. **AC2** - Enrollment Response
   - SaaS validates token and returns agent credentials
   - Response includes: agent_id, organization_id, client_certificate, client_private_key
   - Certificate expiration timestamp included
   - Server fingerprints for certificate pinning

3. **AC3** - Credential Storage
   - Agent stores credentials securely in encrypted database (agent_config table)
   - Uses key-value storage with credentials.* prefix
   - All credential fields stored: agent_id, org_id, cert, key, expires_at, fingerprints

4. **AC4** - Subsequent Restarts
   - Subsequent restarts use stored credentials (no re-enrollment)
   - ensure_enrolled() returns existing credentials if enrolled
   - Certificate expiration warnings at 30 days

5. **AC5** - Error Handling
   - Invalid/expired tokens result in clear error message
   - AlreadyEnrolled error with agent_id if re-enrollment attempted
   - NotEnrolled error if no token provided and not enrolled
   - Retryable errors distinguished from permanent failures

## Tasks / Subtasks

- [x] Task 1: Create Error Module (AC: 5)
  - [x] SyncError enum with specific error variants
  - [x] is_retryable() method for retry logic
  - [x] From implementations for storage/http errors

- [x] Task 2: Create API Types (AC: 1, 2)
  - [x] EnrollmentRequest struct
  - [x] EnrollmentResponse struct
  - [x] StoredCredentials struct with from_enrollment()
  - [x] ApiErrorResponse for error parsing
  - [x] HeartbeatRequest/Response for future use

- [x] Task 3: Create Credentials Repository (AC: 3)
  - [x] store() to save credentials
  - [x] load() to retrieve credentials
  - [x] is_enrolled() check
  - [x] update_certificate() for renewal
  - [x] update_server_fingerprints() for rotation
  - [x] clear() for unenrollment

- [x] Task 4: Create HTTP Client (AC: 1)
  - [x] for_enrollment() without mTLS
  - [x] with_mtls() for authenticated communication
  - [x] Configurable TLS verification and proxy
  - [x] post_json() and post_json_with_token() methods

- [x] Task 5: Create Enrollment Manager (AC: 1, 2, 4)
  - [x] ensure_enrolled() main entry point
  - [x] enroll() for new enrollment
  - [x] System info gathering (hostname, os_info, machine_id)
  - [x] Certificate expiration warnings

- [x] Task 6: Add Test Utils Feature (AC: All)
  - [x] test-utils feature flag in agent-storage
  - [x] Export KeyManager test methods for other crates

- [x] Task 7: Add Comprehensive Tests (AC: All)
  - [x] 35 unit tests covering all modules
  - [x] Error handling tests
  - [x] Credential storage tests
  - [x] Enrollment flow tests

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR5: L'agent peut s'enregistrer auprès du SaaS Sentinel avec token d'authentification
- NFR-S7: Protection credentials jamais stockés en clair, token rotatif
- NFR-I1: Protocole API REST/HTTPS, JSON
- NFR-I2: Authentification API Bearer token + mTLS

### Module Structure

```
agent-sync/src/
├── lib.rs         # Module exports
├── error.rs       # SyncError enum
├── types.rs       # API request/response types
├── credentials.rs # Credential storage repository
├── client.rs      # HTTP client configuration
└── enrollment.rs  # Enrollment manager
```

### Key Design Decisions

- **Bearer Token for Enrollment**: Uses Authorization header for initial enrollment
- **Credential Storage**: Uses agent_config table with credentials.* key prefix
- **Error Categorization**: is_retryable() distinguishes transient from permanent errors
- **System Info**: Gets hostname, OS info, and machine ID for enrollment context
- **Certificate Warnings**: Logs warning when certificate expires within 30 days

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed reqwest gzip() method not available in 0.13.1
- Fixed closure ownership issue with api_error.details
- Added test-utils feature to expose KeyManager::new_with_test_key

### Completion Notes List

- SyncError with 10 error variants and is_retryable() method
- EnrollmentRequest/Response with full field coverage
- StoredCredentials with certificate expiration helpers
- CredentialsRepository with full CRUD operations
- HttpClient for enrollment and mTLS communication
- EnrollmentManager with ensure_enrolled() flow
- System info: hostname, os_info, machine_id (Linux/Windows/macOS)
- 35 unit tests + 1 doctest passing
- test-utils feature for cross-crate test helpers

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/error.rs
- sentinel-agent/crates/agent-sync/src/types.rs
- sentinel-agent/crates/agent-sync/src/credentials.rs
- sentinel-agent/crates/agent-sync/src/client.rs
- sentinel-agent/crates/agent-sync/src/enrollment.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs (exports)
- sentinel-agent/crates/agent-sync/Cargo.toml (dependencies)
- sentinel-agent/crates/agent-storage/Cargo.toml (test-utils feature)
- sentinel-agent/crates/agent-storage/src/key.rs (test-utils cfg)

### Change Log

- 2026-01-23: Created SyncError with retryable detection
- 2026-01-23: Created enrollment API types
- 2026-01-23: Implemented CredentialsRepository
- 2026-01-23: Created HTTP client with TLS configuration
- 2026-01-23: Implemented EnrollmentManager with ensure_enrolled flow
- 2026-01-23: Added test-utils feature for cross-crate testing
- 2026-01-23: All 36 tests passing

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
