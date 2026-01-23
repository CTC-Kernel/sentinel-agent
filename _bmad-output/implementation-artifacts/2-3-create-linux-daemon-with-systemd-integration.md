# Story 2.3: Create Linux Daemon with systemd Integration

Status: done

## Story

As an **administrator**,
I want **the agent to run as a Linux daemon via systemd**,
So that **it integrates with standard Linux service management**.

## Acceptance Criteria

1. **AC1** - systemd Unit File
   - Unit file `sentinel-agent.service` created in `/etc/systemd/system/`
   - Service is Type=simple for direct process management
   - Proper After/Wants dependencies on network

2. **AC2** - Automatic Startup
   - Service starts on boot (`systemctl enable sentinel-agent`)
   - Service can be controlled via `systemctl start/stop/restart`
   - Service status visible via `systemctl status`

3. **AC3** - Recovery Settings
   - Service restarts automatically on crash (Restart=always)
   - RestartSec=10 for delay between restarts
   - Proper security hardening (NoNewPrivileges, ProtectSystem)

4. **AC4** - Resource Limits
   - MemoryMax=100M configured
   - CPUQuota=5% configured
   - Proper working directory and paths

## Tasks / Subtasks

- [x] Task 1: Create systemd Unit File Template (AC: 1, 3, 4)
  - [x] Define unit file with all sections
  - [x] Configure security hardening options
  - [x] Configure resource limits

- [x] Task 2: Implement Install Function (AC: 1, 2)
  - [x] Write unit file to /etc/systemd/system/
  - [x] Run systemctl daemon-reload
  - [x] Run systemctl enable

- [x] Task 3: Implement Uninstall Function (AC: 2)
  - [x] Stop service if running
  - [x] Disable service
  - [x] Remove unit file

- [x] Task 4: Implement Status Functions (AC: 2)
  - [x] Query service state via systemctl is-active
  - [x] Map systemd states to ServiceState enum

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR3: L'agent peut s'exécuter en tant que service système avec démarrage automatique
- NFR-P3: Consommation mémoire agent < 100 MB
- NFR-P1: Impact CPU agent au repos < 0.5%

### systemd Unit File

The unit file includes:
- Security hardening (NoNewPrivileges, ProtectSystem, PrivateTmp)
- Resource limits (MemoryMax=100M, CPUQuota=5%)
- Automatic restart on failure
- Network dependency

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Implemented as part of Story 2.2 (cross-platform service support)
- Uses libc for root privilege detection
- systemctl commands for service management

### Completion Notes List

- ✅ Created systemd unit file template with security hardening
- ✅ Implemented install_service() with daemon-reload and enable
- ✅ Implemented uninstall_service() with stop, disable, and file removal
- ✅ Implemented get_service_state() via systemctl is-active
- ✅ Implemented start_service() and stop_service() via systemctl
- ✅ Resource limits configured: MemoryMax=100M, CPUQuota=5%
- ✅ Root privilege check (is_root() function)

### File List

**New Files Created:**
- sentinel-agent/crates/agent-core/src/service/unix.rs

### Change Log

- 2026-01-23: Implemented systemd integration for Linux daemon support

## Senior Developer Review (AI)

**Reviewer:** Mary (Business Analyst) via Code Review Workflow
**Date:** 2026-01-23
**Model:** Claude Opus 4.5

### Issues Found & Fixed

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | 🟡 MEDIUM | WorkingDirectory inconsistent (`/opt/sentinel` vs `-grc`) | Fixed: Now `/opt/sentinel-grc` |
| 2 | 🟡 MEDIUM | cleanup.rs INSTALL_DIR inconsistent | Fixed: Now `/opt/sentinel-grc` |
| 3 | 🟢 LOW | Added SYSTEMD_SERVICE_NAME constant | Added for consistency |
| 4 | 🟢 LOW | Added NFR reference in unit template comments | Added |

### Verification

- ✅ 17 unit tests passing
- ✅ No compiler warnings
- ✅ Paths consistent between unix.rs and cleanup.rs

### Decision: **APPROVED** ✅
