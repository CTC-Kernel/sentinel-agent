// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Ownership of the agent's data and configuration directories (Unix).
//!
//! The service runs as its own user (`sentinel-grc` on Linux, the logged-in
//! user's LaunchAgent on macOS), while `sudo sentinel-agent enroll` runs as
//! root. Installing then enrolling at once (the command the platform shows)
//! let `enroll` create `agent.db` as root:root 644 before the service did:
//! the service then failed every write ("attempt to write a readonly
//! database"). A command run as root therefore hands what it created, and
//! what an earlier run left, back to the owner of the directory. When the
//! directory itself belongs to root (everything runs as root), nothing
//! changes.

use std::path::{Path, PathBuf};
use tracing::{error, info, warn};

/// The account that must own the files of a directory owned by
/// `dir_owner`, when the current process runs as `euid`: `Some` only for a
/// root process working in a directory of another account.
pub fn handover_target(euid: u32, dir_owner: (u32, u32)) -> Option<(u32, u32)> {
    (euid == 0 && dir_owner.0 != 0).then_some(dir_owner)
}

/// The entries under `dir` (itself excluded, symbolic links not followed)
/// owned by `intruder_uid` (root in practice).
#[cfg(unix)]
pub fn entries_owned_by(dir: &Path, intruder_uid: u32) -> Vec<PathBuf> {
    use std::os::unix::fs::MetadataExt;
    let mut found = Vec::new();
    let mut pending = vec![dir.to_path_buf()];
    while let Some(current) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&current) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(meta) = std::fs::symlink_metadata(&path) else {
                continue;
            };
            if meta.uid() == intruder_uid {
                found.push(path.clone());
            }
            if meta.is_dir() {
                pending.push(path);
            }
        }
    }
    found
}

/// The directories whose files the service reads and writes: the data
/// directory (database, key, caches) and the configuration's.
fn agent_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![agent_common::config::AgentConfig::platform_data_dir()];
    if let Some(config_dir) = agent_common::config::AgentConfig::platform_config_path().parent()
        && !dirs.iter().any(|d| d == config_dir)
    {
        dirs.push(config_dir.to_path_buf());
    }
    dirs
}

/// The agent's own store and configuration files, always the service's:
/// an earlier root run that created them is repaired even when this run
/// did not touch them.
pub const SERVICE_FILES: [&str; 7] = [
    "agent.db",
    "agent.db-wal",
    "agent.db-shm",
    "agent.db.bak",
    ".sentinel-key",
    "agent.json",
    "llm.json",
];

/// Of the root-owned entries `found` now, those to hand to the directory's
/// owner: what appeared since `before` (created by this command) and the
/// service's own files. Other files root owns stay root's: the privileged
/// helper keeps its firewall and isolation state there on purpose.
pub fn to_hand_over(
    found: &[PathBuf],
    before: &std::collections::HashSet<PathBuf>,
) -> Vec<PathBuf> {
    found
        .iter()
        .filter(|path| {
            !before.contains(*path)
                || path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| SERVICE_FILES.contains(&n))
        })
        .cloned()
        .collect()
}

#[cfg(unix)]
static ROOT_OWNED_BEFORE: std::sync::OnceLock<std::collections::HashSet<PathBuf>> =
    std::sync::OnceLock::new();

/// Before a command run as root: note what root already owns in the
/// agent's directories, so that only what the command creates changes
/// hands afterwards.
#[cfg(unix)]
pub fn remember_root_owned_entries() {
    if unsafe { libc::geteuid() } != 0 {
        return;
    }
    let entries = agent_dirs()
        .iter()
        .flat_map(|dir| entries_owned_by(dir, 0))
        .collect();
    let _ = ROOT_OWNED_BEFORE.set(entries);
}

/// After a command run as root: give what it created in the agent's
/// directories, and the service's own files, to the owner of each
/// directory. Returns how many entries changed hands. A no-op when not
/// root or when the directories are root's.
#[cfg(unix)]
pub fn hand_agent_files_to_their_owner() -> usize {
    let empty = std::collections::HashSet::new();
    let before = ROOT_OWNED_BEFORE.get().unwrap_or(&empty);
    let euid = unsafe { libc::geteuid() };
    agent_dirs()
        .iter()
        .map(|dir| hand_over(dir, euid, before))
        .sum()
}

#[cfg(unix)]
fn hand_over(dir: &Path, euid: u32, before: &std::collections::HashSet<PathBuf>) -> usize {
    use std::os::unix::fs::MetadataExt;
    let Ok(meta) = std::fs::metadata(dir) else {
        return 0;
    };
    let Some((uid, gid)) = handover_target(euid, (meta.uid(), meta.gid())) else {
        return 0;
    };
    let mut changed = 0;
    for path in to_hand_over(&entries_owned_by(dir, 0), before) {
        match std::os::unix::fs::lchown(&path, Some(uid), Some(gid)) {
            Ok(()) => changed += 1,
            Err(e) => warn!("Ownership of {} not handed over: {}", path.display(), e),
        }
    }
    if changed > 0 {
        info!(
            "{} file(s) of {} handed back to the account of the service (uid {})",
            changed,
            dir.display(),
            uid
        );
    }
    changed
}

/// The files of the local database and its key that exist but that this
/// process cannot write.
#[cfg(unix)]
pub fn unwritable_store_files(data_dir: &Path) -> Vec<PathBuf> {
    use std::os::unix::ffi::OsStrExt;
    ["agent.db", "agent.db-wal", "agent.db-shm", ".sentinel-key"]
        .iter()
        .map(|name| data_dir.join(name))
        .filter(|path| path.exists())
        .filter(|path| {
            let Ok(c_path) = std::ffi::CString::new(path.as_os_str().as_bytes()) else {
                return false;
            };
            unsafe { libc::access(c_path.as_ptr(), libc::W_OK) != 0 }
        })
        .collect()
}

/// How often a service blocked on an unwritable store looks again.
pub const STORE_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_secs(15);

/// At service start: say once, with the command that fixes it, that the
/// database cannot be written, instead of one error per write. Returns
/// whether the store is writable (logs only when it is not).
#[cfg(unix)]
pub fn report_unwritable_store() -> bool {
    let data_dir = agent_common::config::AgentConfig::platform_data_dir();
    let blocked = unwritable_store_files(&data_dir);
    if blocked.is_empty() {
        return true;
    }
    let list: Vec<String> = blocked.iter().map(|p| p.display().to_string()).collect();
    error!(
        "Base locale non inscriptible par le service ({}) : fichiers créés par une commande \
         lancée en root. Lancez `sudo sentinel-agent status`, qui les rend au propriétaire de \
         {} ; le service reprend seul ensuite.",
        list.join(", "),
        data_dir.display()
    );
    false
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::MetadataExt;

    #[test]
    fn only_root_in_another_accounts_directory_hands_files_over() {
        // enroll as root in /var/lib/sentinel-grc (sentinel-grc: 990)
        assert_eq!(handover_target(0, (990, 990)), Some((990, 990)));
        // everything runs as root: nothing changes
        assert_eq!(handover_target(0, (0, 0)), None);
        // not root: nothing to hand over (and no right to)
        assert_eq!(handover_target(501, (990, 990)), None);
        assert_eq!(handover_target(990, (990, 990)), None);
    }

    #[test]
    fn the_entries_of_the_intruder_are_found_in_the_whole_tree() {
        let dir = tempfile::tempdir().unwrap();
        let me = std::fs::metadata(dir.path()).unwrap().uid();
        std::fs::write(dir.path().join("agent.db"), b"").unwrap();
        std::fs::write(dir.path().join(".sentinel-key"), b"").unwrap();
        std::fs::create_dir(dir.path().join("fim")).unwrap();
        std::fs::write(dir.path().join("fim").join("baseline.json"), b"").unwrap();

        let mut found = entries_owned_by(dir.path(), me);
        found.sort();
        let names: Vec<_> = found
            .iter()
            .map(|p| p.strip_prefix(dir.path()).unwrap().to_path_buf())
            .collect();
        assert_eq!(
            names,
            [
                PathBuf::from(".sentinel-key"),
                PathBuf::from("agent.db"),
                PathBuf::from("fim"),
                PathBuf::from("fim/baseline.json"),
            ]
        );
        // Nothing belongs to another account here.
        assert!(entries_owned_by(dir.path(), me.wrapping_add(12345)).is_empty());
    }

    #[test]
    fn what_the_command_created_and_the_service_files_change_hands() {
        let dir = PathBuf::from("/var/lib/sentinel-grc");
        let helper_state = dir.join("blocked_addresses.json");
        let old_db = dir.join("agent.db");
        let new_cache = dir.join("cache").join("inventory.json");
        let before: std::collections::HashSet<_> =
            [helper_state.clone(), old_db.clone()].into_iter().collect();

        let mut handed = to_hand_over(
            &[helper_state.clone(), old_db.clone(), new_cache.clone()],
            &before,
        );
        handed.sort();
        // The helper's state stays root's; the database left by an earlier
        // root run is repaired; what this run created is handed over.
        assert_eq!(handed, [old_db, new_cache]);
        assert!(
            !to_hand_over(std::slice::from_ref(&helper_state), &before).contains(&helper_state)
        );
    }

    #[test]
    fn a_process_that_is_not_root_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("agent.db"), b"").unwrap();
        assert_eq!(hand_over(dir.path(), 501, &Default::default()), 0);
    }

    #[test]
    fn a_read_only_database_is_reported() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let db = dir.path().join("agent.db");
        std::fs::write(&db, b"").unwrap();
        std::fs::write(dir.path().join("agent.db-wal"), b"").unwrap();
        assert!(unwritable_store_files(dir.path()).is_empty());

        std::fs::set_permissions(&db, std::fs::Permissions::from_mode(0o444)).unwrap();
        // root writes whatever the mode: the check only means something
        // for the service's account.
        if unsafe { libc::geteuid() } != 0 {
            assert_eq!(unwritable_store_files(dir.path()), [db]);
        }
    }
}
