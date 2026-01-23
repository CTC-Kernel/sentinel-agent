# Story 5.8: Implement Obsolete Protocols Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify obsolete protocols are disabled**,
So that **I know endpoints don't expose legacy vulnerabilities**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - SMBv1 status checked via registry/feature
   - TLS 1.0/1.1 status checked via registry
   - SSLv3 status checked via registry
   - Result includes: smbv1_enabled, tls10_enabled, tls11_enabled, sslv3_enabled

2. **AC2** - Linux Check
   - OpenSSL/system crypto policy checked
   - SMB configuration checked
   - Result includes: min_tls_version, weak_ciphers_enabled, crypto_policy

3. **AC3** - macOS Check
   - System crypto settings checked
   - SMB configuration checked
   - Result includes: min_tls_version, smbv1_enabled

4. **AC4** - Compliance Logic
   - Any legacy protocol enabled triggers non-compliant
   - Affected protocols: SSLv2, SSLv3, TLS 1.0, TLS 1.1, SMBv1

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - High severity (Protocols category)

## Tasks / Subtasks

- [x] Task 1: Implement ObsoleteProtocolsStatus Types (AC: All)
  - [x] ObsoleteProtocolsStatus struct
  - [x] Serialization support
  - [x] Compliance validation method

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] SMBv1 feature and registry check
  - [x] TLS/SSL protocol registry keys
  - [x] Client and server protocol status

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] System crypto policy (RHEL/Fedora)
  - [x] OpenSSL minprotocol config
  - [x] Samba SMB min protocol

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] SMB server configuration
  - [x] Default TLS 1.2+ enforcement
  - [x] ATS diagnostics

- [x] Task 5: Add Tests (AC: All)
  - [x] 8 unit tests
  - [x] Compliance logic tests
  - [x] Live execution test

## Dev Notes

### ObsoleteProtocolsStatus Structure

```rust
ObsoleteProtocolsStatus {
    compliant: bool,
    smbv1_enabled: Option<bool>,
    tls10_enabled: Option<bool>,
    tls11_enabled: Option<bool>,
    sslv3_enabled: Option<bool>,
    sslv2_enabled: Option<bool>,
    min_tls_version: Option<String>,
    weak_ciphers_enabled: Option<bool>,
    crypto_policy: Option<String>,
    obsolete_enabled: Vec<String>,
    issues: Vec<String>,
    raw_output: String,
}
```

### Obsolete Protocol List

| Protocol | Risk | CVE |
|----------|------|-----|
| SMBv1 | WannaCry, EternalBlue | CVE-2017-0144 |
| SSLv2 | DROWN | CVE-2016-0800 |
| SSLv3 | POODLE | CVE-2014-3566 |
| TLS 1.0 | BEAST, deprecated | Multiple |
| TLS 1.1 | Deprecated RFC 8996 | - |

### Platform Detection

| Platform | Primary | Config Location |
|----------|---------|-----------------|
| Windows | Registry | SCHANNEL\Protocols |
| Linux | crypto-policies | /etc/crypto-policies/config |
| macOS | defaults | System enforced TLS 1.2+ |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- ObsoleteProtocolsCheck implementing Check trait
- Windows: Registry SCHANNEL + SMBv1 feature
- Linux: crypto-policies + openssl.cnf + smb.conf
- macOS: System enforced TLS 1.2+
- Compliance: any obsolete protocol = fail
- NIS2, DORA framework mapping
- Total: 100 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/obsolete_protocols.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created ObsoleteProtocolsCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 8 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
