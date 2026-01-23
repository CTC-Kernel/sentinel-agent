# Story 1.4: Configure Security Tooling (cargo-audit, cargo-deny)

Status: review

## Story

As a **developer**,
I want **security tooling configured to catch vulnerabilities and license issues**,
So that **we maintain a secure and compliant codebase**.

## Acceptance Criteria

1. **AC1** - Vulnerability Scanning
   - cargo-audit can be run locally
   - RustSec advisory database is checked
   - Vulnerabilities are reported with severity

2. **AC2** - License Compliance
   - deny.toml configured with license allowlist
   - Only approved licenses allowed (MIT, Apache-2.0, MPL-2.0, BSD, ISC)
   - Unknown licenses are denied

3. **AC3** - Dependency Bans
   - Known problematic crates are blocked
   - Duplicate dependencies are warned
   - Wildcard dependencies are denied

4. **AC4** - CI Integration
   - CI fails on vulnerabilities
   - CI fails on license violations
   - Security scan results visible in PR

5. **AC5** - Documentation
   - Security policy documented
   - Instructions for adding new dependencies

## Tasks / Subtasks

- [x] Task 1: Enhance deny.toml Configuration (AC: 2, 3)
  - [x] Add detailed advisories section with source config
  - [x] Configure license exceptions if needed
  - [x] Add known-bad crates to bans.deny list
  - [x] Configure skip-tree for false positives

- [x] Task 2: Install and Test cargo-audit (AC: 1)
  - [x] Install cargo-audit locally
  - [x] Run cargo audit and verify output
  - [x] Create .cargo/audit.toml if needed (not needed - default config works)

- [x] Task 3: Run cargo-deny Verification (AC: 2, 3)
  - [x] Run cargo deny check advisories
  - [x] Run cargo deny check licenses
  - [x] Run cargo deny check bans
  - [x] Fix any issues found

- [x] Task 4: Verify CI Integration (AC: 4)
  - [x] Confirm cargo-deny action in CI
  - [x] Confirm cargo-audit action in CI
  - [x] Verify failure behavior

- [x] Task 5: Create SECURITY.md (AC: 5)
  - [x] Document security scanning process
  - [x] Document dependency approval process
  - [x] Document vulnerability response process

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- NFR-S11: Audit vulnérabilités cargo-audit CI, pentest externe avant GA

### deny.toml Enhancement

The existing deny.toml has basic configuration. Enhancements needed:
- Advisory database source configuration
- License exceptions for specific crates if needed
- Bans for known problematic crates

### Security Tooling Stack

1. **cargo-deny** - License, advisories, bans checking
2. **cargo-audit** - RustSec advisory database scanning
3. **GitHub Dependabot** - Automated dependency updates (optional)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed deny.toml for cargo-deny 0.19 (version 2 format)
- Added OpenSSL and CDLA-Permissive-2.0 licenses for transitive dependencies (aws-lc-sys, webpki-root-certs)
- Added `publish = false` to all workspace crates to mark them as private
- Added `allow-wildcard-paths = true` for workspace path dependencies
- Added `licenses.clarify` sections for our proprietary crates

### Completion Notes List

- ✅ Enhanced deny.toml with version 2 format for cargo-deny 0.19
- ✅ Configured advisory database (RustSec) with yanked = "deny"
- ✅ Added comprehensive license allowlist (15 licenses including transitive deps)
- ✅ Added licenses.clarify for proprietary workspace crates
- ✅ Configured bans with wildcards = "deny" and allow-wildcard-paths = true
- ✅ Installed cargo-audit and cargo-deny locally
- ✅ Verified `cargo audit` passes (0 vulnerabilities)
- ✅ Verified `cargo deny check` passes (advisories ok, bans ok, licenses ok, sources ok)
- ✅ Verified CI has EmbarkStudios/cargo-deny-action@v2 and rustsec/audit-check@v2
- ✅ Created SECURITY.md with comprehensive security documentation

### File List

**Modified Files:**
- sentinel-agent/deny.toml (enhanced for cargo-deny 0.19)
- sentinel-agent/crates/agent-common/Cargo.toml (added publish = false)
- sentinel-agent/crates/agent-core/Cargo.toml (added publish = false)
- sentinel-agent/crates/agent-scanner/Cargo.toml (added publish = false)
- sentinel-agent/crates/agent-storage/Cargo.toml (added publish = false)
- sentinel-agent/crates/agent-sync/Cargo.toml (added publish = false)
- sentinel-agent/crates/agent-system/Cargo.toml (added publish = false)
- sentinel-agent/xtask/Cargo.toml (added publish = false)

**New Files Created:**
- sentinel-agent/SECURITY.md

### Change Log

- 2026-01-23: Configured cargo-deny and cargo-audit security tooling
- 2026-01-23: Created SECURITY.md with security policy documentation

