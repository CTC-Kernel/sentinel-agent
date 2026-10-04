// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Ransomware canary files.
//!
//! A hidden folder of decoy documents is placed in each user's home and
//! `Documents` directory. Nobody opens or edits these files, so a decoy whose
//! content changes, or that is renamed in place, is a near-certain sign that
//! something is encrypting the directory.
//!
//! # Verdicts
//!
//! A folder is judged on its state, not on individual file system events
//! (whose shape differs between inotify, FSEvents and ReadDirectoryChanges):
//!
//! - a decoy whose content changed, or a decoy gone while an unknown file
//!   appeared beside it (rename to `name.ext.locked`): [`CanaryTamper::Encrypted`];
//! - decoys gone and nothing else: [`CanaryTamper::Removed`] (a user cleaning
//!   up is the usual cause).
//!
//! A folder is reported once, then left untouched as evidence; a fresh one is
//! deployed at the next start.
//!
//! # Writing into user directories as root
//!
//! The service usually runs as root while the target directories belong to
//! users, who could swap a path component for a symbolic link to make the
//! service create or hand over files elsewhere. On Unix every step therefore
//! goes through directory descriptors opened with `O_NOFOLLOW`: the decoys
//! are created inside the directory inode the service made itself, and
//! ownership is handed to the user through those descriptors only.

use crate::baseline::compute_blake3;
use chrono::{DateTime, Utc};
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Decoy documents: name, leading bytes of the format, size in bytes.
///
/// The extensions are the ones ransomware goes for first; the leading bytes
/// make the files pass a format check.
const DECOYS: &[(&str, &[u8], usize)] = &[
    ("budget-previsionnel.xlsx", b"PK\x03\x04", 18 * 1024),
    ("contrat-signe.pdf", b"%PDF-1.7\n", 24 * 1024),
    ("notes-reunion.docx", b"PK\x03\x04", 12 * 1024),
    (
        "photo-identite.jpg",
        b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00",
        16 * 1024,
    ),
];

/// Files the operating system drops into any folder; never a sign of tampering.
const OS_METADATA_FILES: &[&str] = &[".DS_Store", ".localized", "desktop.ini", "Thumbs.db"];

/// Quiet period after a file system event before the folder is judged, so a
/// write in progress is not read half-way.
const SETTLE_DELAY: Duration = Duration::from_millis(500);
/// Every folder is also judged on this period, whatever the events received
/// (a deleted folder does not always produce one).
const FULL_CHECK_INTERVAL: Duration = Duration::from_secs(30);

const MANIFEST_VERSION: u32 = 1;

/// A directory that receives a decoy folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanaryTarget {
    /// Directory to protect (a home or `Documents` directory).
    pub directory: PathBuf,
    /// Unix owner (uid, gid) the decoys are handed to, when the service does
    /// not run as that user. `None`: keep the creating user.
    pub owner: Option<(u32, u32)>,
}

/// One deployed decoy file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct DecoyFile {
    name: String,
    /// BLAKE3 of the content written at deployment.
    hash: String,
}

/// One deployed decoy folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct DecoyFolder {
    path: PathBuf,
    files: Vec<DecoyFile>,
    deployed_at: DateTime<Utc>,
    /// Already reported as tampered: kept as evidence, no longer judged.
    #[serde(default)]
    tripped: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Manifest {
    version: u32,
    #[serde(default)]
    folders: Vec<DecoyFolder>,
}

/// What happened to a decoy folder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CanaryTamper {
    /// Decoy content changed or decoys renamed in place: encryption in progress.
    Encrypted,
    /// Decoys deleted or moved away, nothing else.
    Removed,
}

/// A decoy folder found tampered with.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CanaryIncident {
    /// The decoy folder.
    pub folder: PathBuf,
    pub tamper: CanaryTamper,
    /// Decoys whose content changed.
    pub modified: Vec<PathBuf>,
    /// Decoys no longer there.
    pub missing: Vec<PathBuf>,
    /// Files that appeared in the folder (renamed decoys, ransom notes).
    pub foreign: Vec<PathBuf>,
    pub detected_at: DateTime<Utc>,
    /// Found at start-up: it happened while the agent was not running.
    pub while_stopped: bool,
}

/// Outcome of a deployment.
#[derive(Debug, Default)]
pub struct DeployReport {
    /// Decoy folders now in place and watched.
    pub active: usize,
    /// Folders found tampered with at start-up.
    pub incidents: Vec<CanaryIncident>,
    /// Targets skipped, with the reason (missing directory, access denied…).
    pub skipped: Vec<String>,
}

/// Deploys, checks and removes the decoy folders.
pub struct CanaryManager {
    manifest_path: PathBuf,
    manifest: Mutex<Manifest>,
}

impl CanaryManager {
    /// Open the manager, reading the list of decoys deployed earlier.
    pub fn new(manifest_path: impl Into<PathBuf>) -> Self {
        let manifest_path = manifest_path.into();
        let manifest = std::fs::read(&manifest_path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Manifest>(&bytes).ok())
            .filter(|manifest| manifest.version == MANIFEST_VERSION)
            .unwrap_or_else(|| Manifest {
                version: MANIFEST_VERSION,
                folders: Vec::new(),
            });
        Self {
            manifest_path,
            manifest: Mutex::new(manifest),
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Manifest> {
        // The manifest is plain data: a panic elsewhere cannot leave it
        // half-updated in a way worth refusing to read.
        self.manifest.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn save(&self, manifest: &Manifest) {
        let write = || -> std::io::Result<()> {
            if let Some(parent) = self.manifest_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut tmp = self.manifest_path.as_os_str().to_owned();
            tmp.push(".tmp");
            let tmp = PathBuf::from(tmp);
            std::fs::write(&tmp, serde_json::to_vec_pretty(manifest)?)?;
            std::fs::rename(&tmp, &self.manifest_path)
        };
        if let Err(e) = write() {
            warn!(
                "Failed to save canary manifest {}: {}",
                self.manifest_path.display(),
                e
            );
        }
    }

    /// Folders currently watched (deployed and not yet reported).
    pub fn active_folders(&self) -> Vec<PathBuf> {
        self.lock()
            .folders
            .iter()
            .filter(|f| !f.tripped)
            .map(|f| f.path.clone())
            .collect()
    }

    /// Make sure every target holds an intact decoy folder.
    ///
    /// Folders deployed earlier are checked first: one found tampered with is
    /// reported in [`DeployReport::incidents`], and a folder that is gone or
    /// was reported before is replaced by a fresh one.
    pub fn deploy(&self, targets: &[CanaryTarget]) -> DeployReport {
        let mut report = DeployReport::default();
        let mut manifest = self.lock();

        // Judge what is already there.
        let mut kept = Vec::new();
        for folder in std::mem::take(&mut manifest.folders) {
            if folder.tripped {
                continue;
            }
            match judge(&folder) {
                None => kept.push(folder),
                Some(mut incident) => {
                    // A folder that vanished while the agent was stopped is
                    // not worth an alert; changed decoys are.
                    if incident.tamper == CanaryTamper::Encrypted {
                        incident.while_stopped = true;
                        report.incidents.push(incident);
                    } else {
                        debug!(
                            "Canary folder {} was removed while the agent was stopped",
                            folder.path.display()
                        );
                    }
                }
            }
        }
        manifest.folders = kept;

        for target in targets {
            let covered = manifest
                .folders
                .iter()
                .any(|f| f.path.parent() == Some(target.directory.as_path()));
            if covered {
                continue;
            }
            match create_folder(target) {
                Ok(folder) => {
                    info!("Canary folder deployed: {}", folder.path.display());
                    manifest.folders.push(folder);
                }
                Err(e) => report
                    .skipped
                    .push(format!("{}: {}", target.directory.display(), e)),
            }
        }

        report.active = manifest.folders.len();
        self.save(&manifest);
        report
    }

    /// Judge one active folder. A tampered folder is marked as reported and
    /// returned once.
    pub fn check(&self, folder_path: &Path) -> Option<CanaryIncident> {
        let mut manifest = self.lock();
        let folder = manifest
            .folders
            .iter_mut()
            .find(|f| !f.tripped && f.path == folder_path)?;
        let incident = judge(folder)?;
        folder.tripped = true;
        self.save(&manifest);
        Some(incident)
    }

    /// Remove every decoy still exactly as deployed, and forget the rest.
    ///
    /// A file that changed is never deleted: it is no longer known to be ours.
    /// Returns the number of folders removed.
    pub fn remove_all(&self) -> usize {
        let mut manifest = self.lock();
        let mut removed = 0;
        for folder in std::mem::take(&mut manifest.folders) {
            let Ok(metadata) = std::fs::symlink_metadata(&folder.path) else {
                continue;
            };
            if !metadata.is_dir() {
                continue;
            }
            for file in &folder.files {
                let path = folder.path.join(&file.name);
                let untouched = std::fs::symlink_metadata(&path).is_ok_and(|m| m.is_file())
                    && compute_blake3(&path).is_ok_and(|hash| hash == file.hash);
                if untouched && let Err(e) = std::fs::remove_file(&path) {
                    debug!("Failed to remove decoy {}: {}", path.display(), e);
                }
            }
            for name in OS_METADATA_FILES {
                let _ = std::fs::remove_file(folder.path.join(name));
            }
            // Only succeeds when nothing unknown is left inside.
            if std::fs::remove_dir(&folder.path).is_ok() {
                removed += 1;
            }
        }
        self.save(&manifest);
        removed
    }
}

/// Compare a folder with what was deployed. `None`: intact.
fn judge(folder: &DecoyFolder) -> Option<CanaryIncident> {
    let mut modified = Vec::new();
    let mut missing = Vec::new();
    for file in &folder.files {
        let path = folder.path.join(&file.name);
        match std::fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() => match compute_blake3(&path) {
                Ok(hash) if hash == file.hash => {}
                Ok(_) => modified.push(path),
                // Unreadable (locked while being rewritten, permissions
                // changed): it is no longer the file that was deployed.
                Err(_) => modified.push(path),
            },
            _ => missing.push(path),
        }
    }

    let mut foreign = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&folder.path) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            let known = folder.files.iter().any(|f| f.name == name)
                || OS_METADATA_FILES.contains(&name.as_ref())
                || name.starts_with("._");
            if !known {
                foreign.push(entry.path());
            }
        }
    }
    foreign.sort();

    let tamper = if !modified.is_empty() || (!missing.is_empty() && !foreign.is_empty()) {
        CanaryTamper::Encrypted
    } else if !missing.is_empty() {
        CanaryTamper::Removed
    } else {
        return None;
    };
    Some(CanaryIncident {
        folder: folder.path.clone(),
        tamper,
        modified,
        missing,
        foreign,
        detected_at: Utc::now(),
        while_stopped: false,
    })
}

/// Content of a decoy: the format's leading bytes, then filler that looks
/// like compressed data. Different for every folder.
fn decoy_content(magic: &[u8], size: usize, seed: &str) -> Vec<u8> {
    let mut content = vec![0u8; size.max(magic.len())];
    let mut hasher = blake3::Hasher::new();
    hasher.update(seed.as_bytes());
    hasher.finalize_xof().fill(&mut content);
    content[..magic.len()].copy_from_slice(magic);
    content
}

/// Name of a new decoy folder: hidden, sorted before ordinary names (so a
/// directory walk reaches it first), and different on every host.
fn folder_name(target: &Path) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(target.to_string_lossy().as_bytes());
    hasher.update(&std::process::id().to_le_bytes());
    if let Ok(elapsed) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        hasher.update(&elapsed.as_nanos().to_le_bytes());
    }
    let suffix: String = hasher.finalize().to_hex().chars().take(6).collect();
    if cfg!(windows) {
        format!("!0-archives-{suffix}")
    } else {
        format!(".0-archives-{suffix}")
    }
}

fn create_folder(target: &CanaryTarget) -> std::io::Result<DecoyFolder> {
    let name = folder_name(&target.directory);
    let files: Vec<(String, Vec<u8>)> = DECOYS
        .iter()
        .map(|(file_name, magic, size)| {
            (
                (*file_name).to_string(),
                decoy_content(magic, *size, &format!("{name}/{file_name}")),
            )
        })
        .collect();

    write_folder(target, &name, &files)?;

    Ok(DecoyFolder {
        path: target.directory.join(&name),
        files: files
            .iter()
            .map(|(file_name, content)| DecoyFile {
                name: file_name.clone(),
                hash: blake3::hash(content).to_hex().to_string(),
            })
            .collect(),
        deployed_at: Utc::now(),
        tripped: false,
    })
}

/// Create the folder and its files through directory descriptors, never
/// following a symbolic link (see the module documentation).
#[cfg(unix)]
fn write_folder(
    target: &CanaryTarget,
    name: &str,
    files: &[(String, Vec<u8>)],
) -> std::io::Result<()> {
    use std::ffi::CString;
    use std::io::Write;
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
    use std::os::unix::ffi::OsStrExt;

    fn cstring(bytes: &[u8]) -> std::io::Result<CString> {
        CString::new(bytes).map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidInput))
    }
    fn owned(fd: libc::c_int) -> std::io::Result<OwnedFd> {
        if fd < 0 {
            Err(std::io::Error::last_os_error())
        } else {
            // SAFETY: `fd` was just returned by open/openat and is owned by
            // nothing else.
            Ok(unsafe { OwnedFd::from_raw_fd(fd) })
        }
    }
    fn check(result: libc::c_int) -> std::io::Result<()> {
        if result < 0 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(())
        }
    }
    fn owner_of(fd: &OwnedFd) -> std::io::Result<libc::uid_t> {
        // SAFETY: `stat` is plain data fully written by a successful fstat.
        let mut stat: libc::stat = unsafe { std::mem::zeroed() };
        // SAFETY: `fd` is a valid descriptor and `stat` a valid out-pointer.
        check(unsafe { libc::fstat(fd.as_raw_fd(), &mut stat) })?;
        Ok(stat.st_uid)
    }

    const DIR_FLAGS: libc::c_int =
        libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;

    let target_path = cstring(target.directory.as_os_str().as_bytes())?;
    let folder_name = cstring(name.as_bytes())?;

    // SAFETY: `target_path` is a valid NUL-terminated string.
    let parent = owned(unsafe { libc::open(target_path.as_ptr(), DIR_FLAGS) })?;
    // The protected directory must belong to the user the decoys are for: a
    // link swapped in for it would have been refused by O_NOFOLLOW, and a
    // directory owned by someone else is not theirs to be protected.
    if let Some((uid, _)) = target.owner
        && owner_of(&parent)? != uid
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "directory is not owned by the expected user",
        ));
    }

    // SAFETY: valid descriptor and NUL-terminated name. Fails if anything
    // (file, directory or link) already has that name.
    check(unsafe { libc::mkdirat(parent.as_raw_fd(), folder_name.as_ptr(), 0o700) })?;
    // SAFETY: valid descriptor and NUL-terminated name.
    let folder =
        owned(unsafe { libc::openat(parent.as_raw_fd(), folder_name.as_ptr(), DIR_FLAGS) })?;
    // SAFETY: geteuid has no preconditions.
    if owner_of(&folder)? != unsafe { libc::geteuid() } {
        // Not the directory created above: someone replaced it in between.
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "decoy folder was replaced during creation",
        ));
    }

    for (file_name, content) in files {
        let file_name = cstring(file_name.as_bytes())?;
        // SAFETY: valid descriptor and NUL-terminated name; O_EXCL refuses an
        // existing entry and O_NOFOLLOW a link.
        let fd = owned(unsafe {
            libc::openat(
                folder.as_raw_fd(),
                file_name.as_ptr(),
                libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                0o644 as libc::c_uint,
            )
        })?;
        let mut file = std::fs::File::from(fd);
        file.write_all(content)?;
        if let Some((uid, gid)) = target.owner {
            // SAFETY: valid descriptor.
            check(unsafe { libc::fchown(file.as_raw_fd(), uid, gid) })?;
        }
    }

    if let Some((uid, gid)) = target.owner {
        // SAFETY: valid descriptor. Done last: until here the folder belongs
        // to the service and the user cannot alter what goes into it.
        check(unsafe { libc::fchown(folder.as_raw_fd(), uid, gid) })?;
    }
    Ok(())
}

/// Create the folder and its files, refusing anything that already exists,
/// then hide the folder.
#[cfg(not(unix))]
fn write_folder(
    target: &CanaryTarget,
    name: &str,
    files: &[(String, Vec<u8>)],
) -> std::io::Result<()> {
    use std::io::Write;

    let folder = target.directory.join(name);
    std::fs::create_dir(&folder)?;
    // A directory junction swapped in for the new folder would send the
    // decoys elsewhere.
    if !std::fs::symlink_metadata(&folder)?.file_type().is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "decoy folder was replaced during creation",
        ));
    }
    for (file_name, content) in files {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(folder.join(file_name))?;
        file.write_all(content)?;
    }
    #[cfg(windows)]
    {
        if let Err(e) = agent_common::process::silent_command("attrib")
            .arg("+h")
            .arg(&folder)
            .status()
        {
            debug!("Failed to hide {}: {}", folder.display(), e);
        }
    }
    Ok(())
}

/// Directories that receive decoys by default: the home and `Documents`
/// directory of every user the service can write for.
pub fn default_targets() -> Vec<CanaryTarget> {
    let mut targets = Vec::new();
    for (home, owner) in user_homes() {
        for directory in [home.clone(), home.join("Documents")] {
            let is_real_dir =
                std::fs::symlink_metadata(&directory).is_ok_and(|m| m.file_type().is_dir());
            if is_real_dir
                && !targets
                    .iter()
                    .any(|t: &CanaryTarget| t.directory == directory)
            {
                targets.push(CanaryTarget { directory, owner });
            }
        }
    }
    targets
}

/// Home directories to protect, with the owner to hand the decoys to.
#[cfg(unix)]
fn user_homes() -> Vec<(PathBuf, Option<(u32, u32)>)> {
    use std::os::unix::fs::MetadataExt;

    // SAFETY: geteuid has no preconditions.
    let running_as_root = unsafe { libc::geteuid() } == 0;
    if !running_as_root {
        return std::env::var_os("HOME")
            .map(PathBuf::from)
            .filter(|home| home.is_absolute())
            .map(|home| vec![(home, None)])
            .unwrap_or_default();
    }

    let base = if cfg!(target_os = "macos") {
        "/Users"
    } else {
        "/home"
    };
    let mut homes = Vec::new();
    if let Ok(entries) = std::fs::read_dir(base) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with('.') || name == "Shared" || name == "Guest" {
                continue;
            }
            let Ok(metadata) = std::fs::symlink_metadata(entry.path()) else {
                continue;
            };
            // A real directory owned by an ordinary user.
            if metadata.file_type().is_dir() && metadata.uid() != 0 {
                homes.push((entry.path(), Some((metadata.uid(), metadata.gid()))));
            }
        }
    }
    homes.sort();
    homes
}

/// Home directories to protect. Profiles the service cannot write to are
/// skipped at deployment.
#[cfg(not(unix))]
fn user_homes() -> Vec<(PathBuf, Option<(u32, u32)>)> {
    const SYSTEM_PROFILES: &[&str] = &["Public", "Default", "Default User", "All Users"];

    let mut homes: Vec<PathBuf> = Vec::new();
    let users_dir = std::env::var_os("SystemDrive")
        .map(|drive| PathBuf::from(format!("{}\\Users", drive.to_string_lossy())))
        .unwrap_or_else(|| PathBuf::from(r"C:\Users"));
    if let Ok(entries) = std::fs::read_dir(&users_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            let is_dir =
                std::fs::symlink_metadata(entry.path()).is_ok_and(|m| m.file_type().is_dir());
            if is_dir && !name.starts_with('.') && !SYSTEM_PROFILES.contains(&name.as_ref()) {
                homes.push(entry.path());
            }
        }
    }
    if let Some(own) = std::env::var_os("USERPROFILE").map(PathBuf::from)
        && own.is_absolute()
        && !homes.contains(&own)
    {
        homes.push(own);
    }
    homes.sort();
    homes.into_iter().map(|home| (home, None)).collect()
}

/// Watch the active decoy folders until `shutdown` is set, sending one
/// incident per tampered folder.
///
/// File system events trigger a check after a short quiet period; every
/// folder is also checked periodically.
pub async fn watch(
    manager: Arc<CanaryManager>,
    incident_tx: mpsc::Sender<CanaryIncident>,
    shutdown: Arc<AtomicBool>,
) -> Result<(), crate::FimError> {
    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
    let folders = manager.active_folders();
    // Events carry resolved paths (`/private/var/…` for `/var/…` on macOS):
    // match them against both spellings of each folder.
    let mut spellings: Vec<(PathBuf, PathBuf)> = Vec::new();
    for folder in &folders {
        if let Err(e) = watcher.watch(folder, RecursiveMode::NonRecursive) {
            // Still covered by the periodic check.
            debug!("Cannot watch canary folder {}: {}", folder.display(), e);
        }
        spellings.push((folder.clone(), folder.clone()));
        if let Ok(resolved) = folder.canonicalize()
            && resolved != *folder
        {
            spellings.push((resolved, folder.clone()));
        }
    }
    info!("Watching {} ransomware canary folder(s)", folders.len());

    tokio::task::spawn_blocking(move || {
        let _watcher = watcher; // keep the watcher alive for the loop
        // Folder -> first event not yet followed by a check.
        let mut pending: HashMap<PathBuf, Instant> = HashMap::new();
        let mut last_full_check = Instant::now();

        while !shutdown.load(Ordering::Acquire) {
            match rx.recv_timeout(Duration::from_millis(250)) {
                Ok(Ok(event)) => {
                    for path in &event.paths {
                        if let Some((_, folder)) = spellings
                            .iter()
                            .find(|(spelling, _)| path.starts_with(spelling))
                        {
                            pending.entry(folder.clone()).or_insert_with(Instant::now);
                        }
                    }
                }
                Ok(Err(e)) => debug!("Canary watch error: {}", e),
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }

            let mut due: Vec<PathBuf> = pending
                .iter()
                .filter(|(_, first_event)| first_event.elapsed() >= SETTLE_DELAY)
                .map(|(folder, _)| folder.clone())
                .collect();
            if last_full_check.elapsed() >= FULL_CHECK_INTERVAL {
                last_full_check = Instant::now();
                due = folders.clone();
            }
            for folder in due {
                pending.remove(&folder);
                if let Some(incident) = manager.check(&folder) {
                    warn!(
                        "Ransomware canary tampered with: {} ({:?})",
                        incident.folder.display(),
                        incident.tamper
                    );
                    if let Err(e) = incident_tx.try_send(incident) {
                        warn!("Canary incident channel full, incident dropped: {}", e);
                    }
                }
            }
        }
    })
    .await
    .map_err(|e| crate::FimError::Watcher(format!("Canary watcher task failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target(dir: &Path) -> CanaryTarget {
        CanaryTarget {
            directory: dir.to_path_buf(),
            owner: None,
        }
    }

    /// A manager with one decoy folder deployed in a temporary directory.
    fn deployed() -> (tempfile::TempDir, CanaryManager, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path().join("home");
        std::fs::create_dir(&home).unwrap();
        let manager = CanaryManager::new(dir.path().join("canaries.json"));
        let report = manager.deploy(&[target(&home)]);
        assert_eq!(report.active, 1, "skipped: {:?}", report.skipped);
        let folder = manager.active_folders().remove(0);
        (dir, manager, folder)
    }

    #[test]
    fn deploys_hidden_decoys_that_look_like_documents() {
        let (_dir, manager, folder) = deployed();

        let name = folder.file_name().unwrap().to_string_lossy().to_string();
        assert!(name.starts_with(if cfg!(windows) { "!0-" } else { ".0-" }));
        for (file_name, magic, size) in DECOYS {
            let content = std::fs::read(folder.join(file_name)).unwrap();
            assert_eq!(content.len(), *size);
            assert!(content.starts_with(magic));
        }
        assert_eq!(manager.check(&folder), None, "a fresh folder is intact");
    }

    #[test]
    fn deploying_again_keeps_the_intact_folder() {
        let (dir, manager, folder) = deployed();
        let home = dir.path().join("home");

        let report = manager.deploy(&[target(&home)]);
        assert_eq!(report.active, 1);
        assert!(report.incidents.is_empty());
        assert_eq!(manager.active_folders(), std::slice::from_ref(&folder));

        // The manifest survives a restart.
        let reopened = CanaryManager::new(dir.path().join("canaries.json"));
        assert_eq!(reopened.active_folders(), [folder]);
    }

    #[test]
    fn changed_content_is_reported_once_as_encryption() {
        let (_dir, manager, folder) = deployed();
        let victim = folder.join(DECOYS[0].0);
        std::fs::write(&victim, b"encrypted").unwrap();

        let incident = manager.check(&folder).expect("tampering detected");
        assert_eq!(incident.tamper, CanaryTamper::Encrypted);
        assert_eq!(incident.modified, [victim]);
        assert!(incident.missing.is_empty() && incident.foreign.is_empty());
        assert!(!incident.while_stopped);

        assert_eq!(manager.check(&folder), None, "reported only once");
        assert!(manager.active_folders().is_empty());
    }

    #[test]
    fn rename_with_a_new_extension_is_encryption() {
        let (_dir, manager, folder) = deployed();
        let victim = folder.join(DECOYS[1].0);
        let renamed = folder.join(format!("{}.locked", DECOYS[1].0));
        std::fs::rename(&victim, &renamed).unwrap();

        let incident = manager.check(&folder).unwrap();
        assert_eq!(incident.tamper, CanaryTamper::Encrypted);
        assert_eq!(incident.missing, [victim]);
        assert_eq!(incident.foreign, [renamed]);
    }

    #[test]
    fn deleted_decoys_alone_are_a_removal() {
        let (_dir, manager, folder) = deployed();
        std::fs::remove_dir_all(&folder).unwrap();

        let incident = manager.check(&folder).unwrap();
        assert_eq!(incident.tamper, CanaryTamper::Removed);
        assert_eq!(incident.missing.len(), DECOYS.len());
        assert!(incident.modified.is_empty() && incident.foreign.is_empty());
    }

    #[test]
    fn os_metadata_files_are_not_tampering() {
        let (_dir, manager, folder) = deployed();
        std::fs::write(folder.join(".DS_Store"), b"finder").unwrap();
        std::fs::write(folder.join("desktop.ini"), b"shell").unwrap();
        std::fs::write(folder.join("._contrat-signe.pdf"), b"resource fork").unwrap();
        assert_eq!(manager.check(&folder), None);
    }

    #[test]
    fn tampering_while_stopped_is_reported_at_start_and_the_folder_replaced() {
        let (dir, manager, folder) = deployed();
        let home = dir.path().join("home");
        std::fs::write(folder.join(DECOYS[2].0), b"encrypted").unwrap();
        drop(manager);

        let restarted = CanaryManager::new(dir.path().join("canaries.json"));
        let report = restarted.deploy(&[target(&home)]);
        assert_eq!(report.incidents.len(), 1);
        assert!(report.incidents[0].while_stopped);
        assert_eq!(report.incidents[0].tamper, CanaryTamper::Encrypted);
        // The tampered folder is left as evidence and a fresh one deployed.
        assert_eq!(report.active, 1);
        assert!(folder.exists());
        assert_ne!(restarted.active_folders(), [folder]);
    }

    #[test]
    fn folder_removed_while_stopped_is_replaced_without_an_incident() {
        let (dir, manager, folder) = deployed();
        let home = dir.path().join("home");
        std::fs::remove_dir_all(&folder).unwrap();

        let report = manager.deploy(&[target(&home)]);
        assert!(report.incidents.is_empty());
        assert_eq!(report.active, 1);
    }

    #[test]
    fn missing_target_is_skipped_with_a_reason() {
        let dir = tempfile::tempdir().unwrap();
        let manager = CanaryManager::new(dir.path().join("canaries.json"));
        let report = manager.deploy(&[target(&dir.path().join("absent"))]);
        assert_eq!(report.active, 0);
        assert_eq!(report.skipped.len(), 1);
    }

    #[test]
    fn remove_all_deletes_intact_decoys_and_spares_changed_files() {
        let (dir, manager, folder) = deployed();
        let home = dir.path().join("home");
        let other_home = dir.path().join("other");
        std::fs::create_dir(&other_home).unwrap();
        manager.deploy(&[target(&home), target(&other_home)]);
        let folders = manager.active_folders();
        assert_eq!(folders.len(), 2);

        // Someone rewrote a decoy in the first folder: it must survive.
        let changed = folder.join(DECOYS[0].0);
        std::fs::write(&changed, b"now a real document").unwrap();

        assert_eq!(manager.remove_all(), 1);
        assert!(changed.exists(), "a changed file is never deleted");
        assert!(!folders.iter().any(|f| f != &folder && f.exists()));
        assert!(manager.active_folders().is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_target_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        std::fs::create_dir(&real).unwrap();
        let link = dir.path().join("Documents");
        std::os::unix::fs::symlink(&real, &link).unwrap();

        let manager = CanaryManager::new(dir.path().join("canaries.json"));
        let report = manager.deploy(&[target(&link)]);
        assert_eq!(report.active, 0);
        assert_eq!(std::fs::read_dir(&real).unwrap().count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn a_target_owned_by_someone_else_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        // SAFETY: geteuid has no preconditions.
        let other_uid = unsafe { libc::geteuid() }.wrapping_add(1);
        let manager = CanaryManager::new(dir.path().join("canaries.json"));
        let report = manager.deploy(&[CanaryTarget {
            directory: dir.path().to_path_buf(),
            owner: Some((other_uid, 0)),
        }]);
        assert_eq!(report.active, 0);
        assert!(report.skipped[0].contains("not owned by the expected user"));
    }

    #[tokio::test]
    async fn watcher_reports_a_rewritten_decoy() {
        let (_dir, manager, folder) = deployed();
        let manager = Arc::new(manager);
        let (tx, mut rx) = mpsc::channel(4);
        let shutdown = Arc::new(AtomicBool::new(false));
        let task = tokio::spawn(watch(Arc::clone(&manager), tx, Arc::clone(&shutdown)));

        // Let the watcher register before the write.
        tokio::time::sleep(Duration::from_millis(300)).await;
        std::fs::write(folder.join(DECOYS[3].0), b"encrypted").unwrap();

        let incident = tokio::time::timeout(Duration::from_secs(15), rx.recv())
            .await
            .expect("incident within the delay")
            .expect("channel open");
        assert_eq!(incident.folder, folder);
        assert_eq!(incident.tamper, CanaryTamper::Encrypted);

        shutdown.store(true, Ordering::Release);
        task.await.unwrap().unwrap();
    }
}
