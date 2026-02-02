# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Sentinel GRC Agent, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to: contact@cyber-threat-consulting.com
3. Include a detailed description and reproduction steps
4. Allow 90 days for remediation before public disclosure

## Security Scanning

### Automated Checks

This project uses the following automated security tools:

#### cargo-audit

Scans dependencies against the [RustSec Advisory Database](https://rustsec.org/).

```bash
# Install
cargo install cargo-audit

# Run locally
cargo audit
```

**CI Integration**: Runs on every PR via `rustsec/audit-check@v2`

#### cargo-deny

Comprehensive dependency checker for:
- **Advisories**: Security vulnerabilities from RustSec
- **Licenses**: Ensures only approved licenses are used
- **Bans**: Blocks known problematic crates
- **Sources**: Validates crate registry sources

```bash
# Install
cargo install cargo-deny

# Run all checks
cargo deny check

# Run specific checks
cargo deny check advisories
cargo deny check licenses
cargo deny check bans
cargo deny check sources
```

**CI Integration**: Runs on every PR via `EmbarkStudios/cargo-deny-action@v2`

### Allowed Licenses

The following licenses are approved for dependencies:

- MIT
- Apache-2.0
- Apache-2.0 WITH LLVM-exception
- MPL-2.0
- BSD-2-Clause, BSD-3-Clause
- ISC
- Zlib, 0BSD
- Unicode-DFS-2016, Unicode-3.0
- CC0-1.0, BSL-1.0
- OpenSSL (for crypto libraries)
- CDLA-Permissive-2.0 (for certificate data)

## Adding New Dependencies

Before adding a new dependency:

1. **Check the license**: Ensure it's in the approved list above
2. **Check for vulnerabilities**: Run `cargo audit` after adding
3. **Verify the source**: Only crates.io is allowed
4. **Review the crate**: Check maintenance status and security history

```bash
# After adding a dependency
cargo deny check
cargo audit
```

### Adding License Exceptions

If a new dependency requires a license not in the approved list:

1. Evaluate the license for compatibility
2. Add it to `deny.toml` under `[licenses].allow`
3. Document the reason in the PR
4. Get security team approval

## Banned Crates

Certain crates are explicitly banned for security or architectural reasons:

| Crate | Reason |
|-------|--------|
| (none currently) | - |

To add a ban, update `deny.toml`:

```toml
[bans]
deny = [
    { crate = "crate-name", reason = "Security concern description" },
]
```

## Vulnerability Response

### When a Vulnerability is Found

1. **Triage**: Assess severity using CVSS
2. **Mitigate**: Apply temporary workaround if needed
3. **Update**: Upgrade to patched version when available
4. **Verify**: Run full security scan suite
5. **Release**: Deploy fix with security advisory

### Ignoring Advisories

In rare cases where no fix is available:

1. Document the advisory ID and reason in `deny.toml`
2. Create a tracking issue
3. Set a review deadline

```toml
[advisories]
ignore = [
    "RUSTSEC-XXXX-XXXX", # Reason + tracking issue link
]
```

## CI/CD Security

### Pipeline Security

- All security checks run on every PR
- PRs cannot merge if security checks fail
- Dependencies are cached but verified
- Build artifacts are signed (planned)

### Quality Gates

| Check | Failure Action |
|-------|----------------|
| cargo-audit | Block merge |
| cargo-deny advisories | Block merge |
| cargo-deny licenses | Block merge |
| cargo-deny bans | Block merge |
| cargo-deny sources | Block merge |

## Best Practices

### Code Security

- Use `#[forbid(unsafe_code)]` where possible
- Prefer safe abstractions over raw pointer manipulation
- Use constant-time comparisons for secrets
- Never log sensitive data

### Dependency Security

- Pin exact versions in Cargo.lock
- Review changelogs before updating
- Prefer well-maintained crates with security policies
- Minimize transitive dependency count

### Agent Security Scanner

The agent includes built-in security scanning capabilities:

- **Vulnerability Scanning**: Periodic CVE-based vulnerability detection against installed packages
- **Process Monitoring**: Detection of suspicious processes and security-relevant events
- **File Integrity Monitoring (FIM)**: Alerts on unauthorized changes to critical system files

### Runtime Security

- Run with least privileges
- Validate all external input
- Use secure defaults (TLS, encryption)
- Implement proper error handling (no panics in production)
