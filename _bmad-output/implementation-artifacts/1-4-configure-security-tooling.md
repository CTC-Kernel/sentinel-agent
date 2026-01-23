# Story 1.4: Configure Security Tooling (cargo-audit, cargo-deny)

Status: in-progress

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

- [ ] Task 1: Enhance deny.toml Configuration (AC: 2, 3)
  - [ ] Add detailed advisories section with source config
  - [ ] Configure license exceptions if needed
  - [ ] Add known-bad crates to bans.deny list
  - [ ] Configure skip-tree for false positives

- [ ] Task 2: Install and Test cargo-audit (AC: 1)
  - [ ] Install cargo-audit locally
  - [ ] Run cargo audit and verify output
  - [ ] Create .cargo/audit.toml if needed

- [ ] Task 3: Run cargo-deny Verification (AC: 2, 3)
  - [ ] Run cargo deny check advisories
  - [ ] Run cargo deny check licenses
  - [ ] Run cargo deny check bans
  - [ ] Fix any issues found

- [ ] Task 4: Verify CI Integration (AC: 4)
  - [ ] Confirm cargo-deny action in CI
  - [ ] Confirm cargo-audit action in CI
  - [ ] Verify failure behavior

- [ ] Task 5: Create SECURITY.md (AC: 5)
  - [ ] Document security scanning process
  - [ ] Document dependency approval process
  - [ ] Document vulnerability response process

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log

