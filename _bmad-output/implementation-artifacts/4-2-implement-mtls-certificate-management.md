# Story 4.2: Implement mTLS Certificate Management

Status: review

## Story

As a **security officer**,
I want **all agent-SaaS communication secured with mTLS**,
So that **both parties are mutually authenticated**.

## Acceptance Criteria

1. **AC1** - mTLS Communication
   - Agent uses client certificate for all authenticated communication
   - mTLS configured automatically from stored credentials
   - TLS 1.3 enforced as minimum version (NFR-S1)

2. **AC2** - Certificate Storage
   - Client certificate stored encrypted (SQLCipher via agent-storage)
   - Private key stored encrypted alongside certificate
   - Credentials loaded on-demand with caching

3. **AC3** - Certificate Renewal
   - Certificate renewal handled automatically before expiry
   - Renewal threshold: 30 days before expiration
   - POST /v1/agents/{id}/certificate/renew endpoint
   - New certificate stored and client refreshed

4. **AC4** - Graceful Failure
   - Communication fails gracefully if certificate is invalid
   - Expired certificate returns clear error message
   - NotEnrolled error if credentials not found

## Tasks / Subtasks

- [x] Task 1: Add TLS 1.3 Minimum Version (AC: 1)
  - [x] Add MIN_TLS_VERSION constant
  - [x] Configure min_tls_version on both client builders
  - [x] Update enrollment and mTLS clients

- [x] Task 2: Create Certificate Renewal Types (AC: 3)
  - [x] CertificateRenewalRequest struct
  - [x] CertificateRenewalResponse struct
  - [x] Export from types module

- [x] Task 3: Create AuthenticatedClient (AC: 1, 2, 4)
  - [x] new() with config and database
  - [x] agent_id() and organization_id() accessors
  - [x] is_enrolled() check
  - [x] get_client() with caching and validation
  - [x] post_json() and get() delegated methods

- [x] Task 4: Implement Certificate Expiration Handling (AC: 3, 4)
  - [x] certificate_expires_at() accessor
  - [x] needs_renewal() check (30-day threshold)
  - [x] Expired certificate error handling
  - [x] Warning logs for approaching expiry

- [x] Task 5: Implement Certificate Renewal Flow (AC: 3)
  - [x] renew_certificate() method
  - [x] POST to /v1/agents/{id}/certificate/renew
  - [x] Update stored credentials
  - [x] Invalidate cached client
  - [x] check_and_renew_if_needed() convenience method

- [x] Task 6: Add Comprehensive Tests (AC: All)
  - [x] test_is_enrolled_false/true
  - [x] test_agent_id
  - [x] test_needs_renewal_false/true
  - [x] test_not_enrolled_error
  - [x] test_invalidate

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- NFR-S1: TLS 1.3 minimum for all communications
- NFR-I2: mTLS authentication after enrollment
- Certificate stored in encrypted SQLCipher database

### Client Architecture

```
AuthenticatedClient
├── config: AgentConfig
├── db: Arc<Database>
└── state: RwLock<ClientState>
    ├── client: Option<HttpClient>     # Cached mTLS client
    ├── credentials: Option<StoredCredentials>
    └── last_refresh: Option<DateTime>

Flow:
1. post_json() / get() called
2. get_client() checks cache
3. If expired/missing, refresh_client()
4. refresh_client() loads credentials, creates mTLS client
5. Returns cached or new client
```

### Key Design Decisions

- **Lazy Initialization**: Client created on first use, not at construction
- **RwLock for State**: Allows concurrent reads, exclusive writes
- **Arc<Database>**: Shared database reference for async context
- **30-Day Renewal Threshold**: Balance between early renewal and certificate lifetime
- **Cache Invalidation**: invalidate() method for credential updates

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Added MIN_TLS_VERSION constant for TLS 1.3
- Created AuthenticatedClient with credential caching
- All 43 tests passing

### Completion Notes List

- MIN_TLS_VERSION = tls::Version::TLS_1_3
- min_tls_version() on both enrollment and mTLS client builders
- CertificateRenewalRequest/Response types
- AuthenticatedClient with:
  - Lazy mTLS client creation
  - Credential caching with RwLock
  - Certificate expiration checking
  - Automatic renewal flow
  - Graceful error handling
- RENEWAL_THRESHOLD_DAYS = 30
- 7 new AuthenticatedClient tests
- Total: 43 tests passing

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/authenticated_client.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/client.rs (TLS 1.3 minimum)
- sentinel-agent/crates/agent-sync/src/types.rs (renewal types)
- sentinel-agent/crates/agent-sync/src/lib.rs (exports)

### Change Log

- 2026-01-23: Added TLS 1.3 minimum version enforcement
- 2026-01-23: Created CertificateRenewalRequest/Response types
- 2026-01-23: Implemented AuthenticatedClient with credential caching
- 2026-01-23: Added certificate renewal flow
- 2026-01-23: All 43 tests passing

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
