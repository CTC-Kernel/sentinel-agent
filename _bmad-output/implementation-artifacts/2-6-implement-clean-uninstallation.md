# Story 2.6: Implement Clean Uninstallation

Status: review

## Story

As an **administrator**,
I want **the agent to uninstall cleanly without leaving residues**,
So that **I can remove agents from endpoints completely**.

## Acceptance Criteria

1. **AC1** - Service Cleanup
   - Service is stopped before uninstall
   - Service registration is removed
   - No orphan processes remain

2. **AC2** - File Cleanup
   - Agent binary is removed
   - Installation directory is removed (if empty)
   - Registry keys removed (Windows)

3. **AC3** - Data Preservation Options
   - Configuration files optionally preserved
   - Logs preserved for audit purposes
   - Database optionally preserved

4. **AC4** - CLI Uninstall Command
   - `sentinel-agent uninstall` removes service
   - `sentinel-agent uninstall --purge` removes all data
   - Clear feedback during uninstallation

5. **AC5** - Package Manager Integration
   - MSI uninstall works cleanly
   - DEB/RPM uninstall works cleanly
   - Purge option removes all data

## Tasks / Subtasks

- [x] Task 1: Enhance CLI Uninstall Command (AC: 1, 4)
  - [x] Add --purge flag for complete removal
  - [x] Add --keep-logs flag to preserve logs
  - [x] Improve user feedback

- [x] Task 2: Implement Data Cleanup Functions (AC: 2, 3)
  - [x] Create cleanup module
  - [x] Implement config preservation logic
  - [x] Implement database cleanup

- [x] Task 3: Verify Package Uninstallation (AC: 5)
  - [x] Verified MSI script handles purge via custom action
  - [x] Verified DEB postrm handles remove vs purge
  - [x] RPM uses same cleanup module via CLI

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR7: L'agent peut se désinstaller proprement sans laisser de résidus

### Uninstallation Paths

**Windows:**
- Binary: `C:\Program Files\Sentinel\`
- Config: `C:\ProgramData\Sentinel\`
- Logs: `C:\ProgramData\Sentinel\logs\`
- Database: `C:\ProgramData\Sentinel\data\`

**Linux:**
- Binary: `/opt/sentinel/`
- Config: `/etc/sentinel/`
- Logs: `/var/log/sentinel-grc/`
- Database: `/var/lib/sentinel-grc/`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Added cleanup module with platform-specific paths
- Enhanced CLI with --purge and --keep-logs flags
- Integrated cleanup with service uninstallation

### Completion Notes List

- ✅ Added --purge flag to CLI Uninstall command
- ✅ Added --keep-logs flag to preserve logs even with --purge
- ✅ Created cleanup module with CleanupOptions and CleanupResult
- ✅ Platform-specific paths (Windows/Linux) in cleanup module
- ✅ Config, logs, and database cleanup based on options
- ✅ Installation directory removed only if empty
- ✅ Clear feedback during uninstallation
- ✅ Debian postrm already handles purge case correctly

### File List

**New Files Created:**
- sentinel-agent/crates/agent-core/src/cleanup.rs

**Modified Files:**
- sentinel-agent/crates/agent-core/src/lib.rs (added cleanup module)
- sentinel-agent/crates/agent-core/src/main.rs (enhanced handle_uninstall)

### Change Log

- 2026-01-23: Created cleanup module with platform-specific paths
- 2026-01-23: Enhanced CLI uninstall command with --purge and --keep-logs
- 2026-01-23: Integrated cleanup with service uninstallation workflow
