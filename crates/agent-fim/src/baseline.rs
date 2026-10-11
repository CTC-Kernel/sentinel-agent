// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Baseline of the watched files, and what differs from it.
//!
//! The baseline records, for every watched file, its BLAKE3 hash, size,
//! modification time, permission bits and owner. BLAKE3 is used because it is
//! several times faster than SHA-256; SHA-256 is computed only for a file
//! that changed, since that is the hash indicator feeds are keyed by.
//!
//! Every reader of a file goes through [`BaselineManager::observe`]: the file
//! is read, compared with its entry and recorded as one step, so the
//! real-time watcher and a full scan agree on what has already been reported.
//!
//! A file the agent may not read (`/etc/shadow` for a service that is not
//! root) is still followed: its size and modification time stand for its
//! contents, and its permissions and owner are compared as for any file.

use agent_common::types::{
    FimAlert, FimAttribute, FimBaseline, FimChangeType, FimDetection, FimOwner,
};
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, RwLock};
use tracing::{debug, warn};
use walkdir::WalkDir;

/// Depth a scan goes below a watched path.
const MAX_SCAN_DEPTH: usize = 32;

/// Files a baseline holds at most. A watched path larger than this is
/// followed up to the limit and the rest is reported as not monitored.
pub const MAX_BASELINE_FILES: usize = 100_000;

/// What reading a file against its baseline entry found.
#[derive(Debug, Clone)]
pub enum Observation {
    /// The file is as recorded (or cannot be told apart from it).
    Unchanged,
    /// A file with no entry.
    Created(FimBaseline),
    /// The entry's file is gone, or is no longer a regular file.
    Deleted(FimBaseline),
    /// The file differs from its entry in `attributes`.
    Changed {
        old: FimBaseline,
        new: FimBaseline,
        attributes: Vec<FimAttribute>,
        /// The lines removed and added, when the last contents of the file
        /// were kept (see [`crate::content`]).
        diff: Option<String>,
    },
}

fn known_hash(hash: &str) -> Option<String> {
    (!hash.is_empty()).then(|| hash.to_string())
}

fn owner_of(entry: &FimBaseline) -> Option<FimOwner> {
    Some(FimOwner {
        uid: entry.uid?,
        gid: entry.gid?,
    })
}

impl Observation {
    /// Whether the file differs from its entry.
    pub fn is_change(&self) -> bool {
        !matches!(self, Self::Unchanged)
    }

    /// The alert this observation is reported as, if it is a change.
    ///
    /// The SHA-256 of a new or rewritten file is computed here, so only the
    /// files that changed are read a second time.
    pub fn into_alert(self, detection: FimDetection) -> Option<FimAlert> {
        match self {
            Self::Unchanged => None,
            Self::Created(new) => Some(FimAlert {
                new_sha256: compute_sha256_proof(&new.path).ok(),
                new_hash: known_hash(&new.hash),
                new_size: Some(new.size),
                ..FimAlert::new(new.path, FimChangeType::Created, detection)
            }),
            Self::Deleted(old) => Some(FimAlert {
                old_hash: known_hash(&old.hash),
                ..FimAlert::new(old.path, FimChangeType::Deleted, detection)
            }),
            Self::Changed {
                old,
                new,
                attributes,
                diff,
            } => {
                let content = attributes.contains(&FimAttribute::Content);
                let permissions = attributes.contains(&FimAttribute::Permissions);
                let ownership = attributes.contains(&FimAttribute::Owner)
                    || attributes.contains(&FimAttribute::Group);
                let change = if content {
                    FimChangeType::Modified
                } else {
                    FimChangeType::PermissionChanged
                };
                Some(FimAlert {
                    old_hash: known_hash(&old.hash),
                    new_hash: known_hash(&new.hash),
                    new_size: Some(new.size),
                    new_sha256: content
                        .then(|| compute_sha256_proof(&new.path).ok())
                        .flatten(),
                    old_permissions: permissions.then_some(old.permissions),
                    new_permissions: permissions.then_some(new.permissions),
                    old_owner: ownership.then(|| owner_of(&old)).flatten(),
                    new_owner: ownership.then(|| owner_of(&new)).flatten(),
                    changed_attributes: attributes,
                    diff,
                    ..FimAlert::new(new.path, change, detection)
                })
            }
        }
    }
}

/// What a full scan found.
#[derive(Debug, Default)]
pub struct ScanReport {
    /// Every difference with the baseline, already recorded in it.
    pub changes: Vec<Observation>,
    /// Files read.
    pub files: usize,
    /// Whether the baseline was full before the end of the watched paths.
    pub truncated: bool,
}

/// Manages file baselines for integrity comparison.
pub struct BaselineManager {
    /// In-memory baseline store: path -> baseline entry.
    baselines: RwLock<HashMap<PathBuf, FimBaseline>>,
    /// Held while one file is read, compared and recorded.
    apply: Mutex<()>,
    /// Held for the length of a full scan: two scans never overlap, so one
    /// started under a former policy cannot undo what the next one records.
    scanning: Mutex<()>,
    /// Whether the baseline differs from the one last saved.
    dirty: AtomicBool,
    /// Last contents of the small text files, to say what changed in them
    /// (`None`: only that they changed).
    content: Option<crate::content::ContentStore>,
}

impl BaselineManager {
    /// Create a new empty baseline manager.
    pub fn new() -> Self {
        Self {
            baselines: RwLock::new(HashMap::new()),
            apply: Mutex::new(()),
            scanning: Mutex::new(()),
            dirty: AtomicBool::new(false),
            content: None,
        }
    }

    /// Keep the last contents of the small text files in `store`, so a
    /// change says which lines were removed and added.
    #[must_use]
    pub fn with_content_store(mut self, store: crate::content::ContentStore) -> Self {
        self.content = Some(store);
        self
    }

    fn read(&self) -> std::sync::RwLockReadGuard<'_, HashMap<PathBuf, FimBaseline>> {
        self.baselines.read().unwrap_or_else(|poisoned| {
            warn!("Baseline RwLock poisoned during read, recovering");
            poisoned.into_inner()
        })
    }

    fn write(&self) -> std::sync::RwLockWriteGuard<'_, HashMap<PathBuf, FimBaseline>> {
        self.baselines.write().unwrap_or_else(|poisoned| {
            warn!("Baseline RwLock poisoned during write, recovering");
            poisoned.into_inner()
        })
    }

    /// Create a baseline for all files under the given path.
    ///
    /// Returns the number of files baselined.
    pub fn create_baseline(
        &self,
        root: &Path,
        ignore_patterns: &[String],
    ) -> Result<usize, crate::FimError> {
        let mut report = ScanReport::default();
        let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        self.walk(
            &root,
            ignore_patterns,
            MAX_SCAN_DEPTH,
            &mut HashSet::new(),
            &mut report,
        );
        Ok(report.files)
    }

    /// Read every file below `root` against the baseline.
    fn walk(
        &self,
        root: &Path,
        ignore_patterns: &[String],
        depth: usize,
        visited: &mut HashSet<PathBuf>,
        report: &mut ScanReport,
    ) {
        let walker = WalkDir::new(root)
            .follow_links(false)
            .max_depth(depth)
            .into_iter()
            .filter_entry(|e| !is_ignored(e.path(), ignore_patterns));

        for entry in walker.flatten() {
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.into_path();
            if !visited.insert(path.clone()) {
                continue;
            }
            if self.count() >= MAX_BASELINE_FILES && self.get_exact(&path).is_none() {
                report.truncated = true;
                continue;
            }
            report.files += 1;
            let observation = self.observe_key(path);
            if observation.is_change() {
                report.changes.push(observation);
            }
        }
    }

    /// Read `path` against its entry and record what is found.
    ///
    /// The last component of `path` is not followed: a watched file replaced
    /// by a symbolic link is a deleted file, not the link's target.
    pub fn observe(&self, path: &Path) -> Observation {
        self.observe_key(entry_path(path))
    }

    fn observe_key(&self, key: PathBuf) -> Observation {
        let _one_at_a_time = self.apply.lock().unwrap_or_else(|e| e.into_inner());
        let (state, text) = match read_state(&key, self.content.is_some()) {
            FileState::Present(new, text) => (FileState::Present(new, None), text),
            other => (other, None),
        };
        let present = matches!(state, FileState::Present(..));
        let mut observation = {
            let mut baselines = self.write();
            match state {
                FileState::Unreadable => Observation::Unchanged,
                FileState::Missing => match baselines.remove(&key) {
                    Some(old) => Observation::Deleted(old),
                    None => Observation::Unchanged,
                },
                FileState::Present(new, _) => match baselines.get(&key) {
                    None => {
                        if baselines.len() < MAX_BASELINE_FILES {
                            baselines.insert(key.clone(), new.clone());
                        }
                        Observation::Created(new)
                    }
                    Some(old) => {
                        let attributes = changed_attributes(old, &new);
                        if attributes.is_empty() {
                            // Keep the recorded modification time current without
                            // reporting it: a rewrite with the same bytes is not a change.
                            if old.modified_at != new.modified_at {
                                baselines.insert(key.clone(), new);
                                self.dirty.store(true, Ordering::Release);
                            }
                            Observation::Unchanged
                        } else {
                            let old = old.clone();
                            baselines.insert(key.clone(), new.clone());
                            Observation::Changed {
                                old,
                                new,
                                attributes,
                                diff: None,
                            }
                        }
                    }
                },
            }
        };
        if let Some(store) = &self.content {
            match &mut observation {
                Observation::Deleted(_) => store.forget(&key),
                Observation::Changed {
                    attributes, diff, ..
                } => {
                    if attributes.contains(&FimAttribute::Content)
                        && let (Some(before), Some(after)) = (store.previous(&key), &text)
                    {
                        *diff = crate::content::diff_lines(&before, after);
                    }
                    // The new contents, or nothing if the file may no longer
                    // be copied (it is no longer text, or no longer readable
                    // by everyone).
                    match &text {
                        Some(text) => store.remember(&key, text),
                        None => store.forget(&key),
                    }
                }
                Observation::Created(_) => {
                    if let Some(text) = &text {
                        store.remember(&key, text);
                    }
                }
                // A file met before its contents were kept: keep them now,
                // for its next change.
                Observation::Unchanged => {
                    if present
                        && let Some(text) = &text
                        && !store.holds(&key)
                    {
                        store.remember(&key, text);
                    }
                }
            }
        }
        if observation.is_change() {
            self.dirty.store(true, Ordering::Release);
        }
        observation
    }

    /// Read every file of the watched paths against the baseline.
    ///
    /// Entries of a path that is no longer watched, or that is now ignored,
    /// are dropped without being reported.
    pub fn scan(
        &self,
        roots: &[PathBuf],
        ignore_patterns: &[String],
        recursive: bool,
    ) -> ScanReport {
        let _one_scan = self.scanning.lock().unwrap_or_else(|e| e.into_inner());
        let mut report = ScanReport::default();
        let mut visited: HashSet<PathBuf> = HashSet::new();
        // A root that cannot be resolved (removed since) keeps its literal
        // path, so its entries are still found gone rather than forgotten.
        let scope: Vec<PathBuf> = roots
            .iter()
            .map(|root| root.canonicalize().unwrap_or_else(|_| root.clone()))
            .collect();
        let depth = if recursive { MAX_SCAN_DEPTH } else { 1 };

        for root in &scope {
            self.walk(root, ignore_patterns, depth, &mut visited, &mut report);
        }

        // Entries the walk did not meet: deleted files, files deeper than the
        // walk goes, and files of a path the policy no longer covers.
        let unvisited: Vec<PathBuf> = self
            .read()
            .keys()
            .filter(|path| !visited.contains(*path))
            .cloned()
            .collect();
        for path in unvisited {
            let covered = scope.iter().any(|root| path.starts_with(root));
            if !covered || is_ignored(&path, ignore_patterns) {
                if self.write().remove(&path).is_some() {
                    self.dirty.store(true, Ordering::Release);
                }
                continue;
            }
            let observation = self.observe_key(path);
            if observation.is_change() {
                report.changes.push(observation);
            }
        }

        if report.truncated {
            warn!(
                "FIM baseline is full ({} files): the rest of the watched paths is not monitored",
                MAX_BASELINE_FILES
            );
        }
        report
    }

    /// Replace the baseline with saved entries (the state before a restart).
    pub fn restore(&self, entries: Vec<FimBaseline>) {
        let mut baselines = self.write();
        baselines.clear();
        for entry in entries.into_iter().take(MAX_BASELINE_FILES) {
            baselines.insert(entry.path.clone(), entry);
        }
    }

    /// Every entry, in path order (the order a saved baseline is written in).
    pub fn entries(&self) -> Vec<FimBaseline> {
        let mut entries: Vec<FimBaseline> = self.read().values().cloned().collect();
        entries.sort_by(|a, b| a.path.cmp(&b.path));
        entries
    }

    /// Whether the baseline changed since this was last asked.
    pub fn take_dirty(&self) -> bool {
        self.dirty.swap(false, Ordering::AcqRel)
    }

    /// Mark the baseline as differing from the saved one (a save failed).
    pub fn mark_dirty(&self) {
        self.dirty.store(true, Ordering::Release);
    }

    fn get_exact(&self, path: &Path) -> Option<FimBaseline> {
        self.read().get(path).cloned()
    }

    /// Whether `path`, taken as written, has an entry.
    pub(crate) fn has_entry(&self, path: &Path) -> bool {
        self.read().contains_key(path)
    }

    /// Look up the baseline for a given path.
    pub fn get(&self, path: &Path) -> Option<FimBaseline> {
        self.get_exact(&baseline_path(path))
    }

    /// Update the baseline for a specific file.
    pub fn update(&self, path: &Path) -> Result<Option<FimBaseline>, crate::FimError> {
        let normalized = path.canonicalize()?;
        let path = normalized.as_path();
        let new_baseline = compute_file_baseline(path)?;
        let old = self.write().insert(path.to_path_buf(), new_baseline);
        self.dirty.store(true, Ordering::Release);
        Ok(old)
    }

    /// Remove a path from the baseline (e.g., when file is deleted).
    pub fn remove(&self, path: &Path) -> Option<FimBaseline> {
        let removed = self.write().remove(&baseline_path(path));
        if removed.is_some() {
            self.dirty.store(true, Ordering::Release);
        }
        removed
    }

    /// Get the total number of baselined files.
    pub fn count(&self) -> usize {
        self.read().len()
    }
}

impl Default for BaselineManager {
    fn default() -> Self {
        Self::new()
    }
}

/// The state of a path, read without following its last component.
enum FileState {
    /// The entry of the file, and its text when a copy of it may be kept.
    Present(FimBaseline, Option<String>),
    /// Gone, or no longer a regular file.
    Missing,
    /// Present but its state cannot be read: nothing can be concluded.
    Unreadable,
}

fn read_state(path: &Path, keep_text: bool) -> FileState {
    use std::io::ErrorKind;
    match fs::symlink_metadata(path) {
        Ok(metadata) if !metadata.is_file() => FileState::Missing,
        Ok(metadata) => match baseline_with_text(path, &metadata, keep_text) {
            Ok((baseline, text)) => FileState::Present(baseline, text),
            Err(e) => {
                debug!("FIM: cannot read {}: {}", path.display(), e);
                FileState::Unreadable
            }
        },
        Err(e) if matches!(e.kind(), ErrorKind::NotFound | ErrorKind::NotADirectory) => {
            FileState::Missing
        }
        Err(e) => {
            debug!("FIM: cannot stat {}: {}", path.display(), e);
            FileState::Unreadable
        }
    }
}

/// What differs between two states of a file.
fn changed_attributes(old: &FimBaseline, new: &FimBaseline) -> Vec<FimAttribute> {
    let mut attributes = Vec::new();
    let content = if old.hash.is_empty() || new.hash.is_empty() {
        old.size != new.size || old.modified_at != new.modified_at
    } else {
        old.hash != new.hash
    };
    if content {
        attributes.push(FimAttribute::Content);
    }
    if old.permissions != new.permissions {
        attributes.push(FimAttribute::Permissions);
    }
    if let (Some(old), Some(new)) = (old.uid, new.uid)
        && old != new
    {
        attributes.push(FimAttribute::Owner);
    }
    if let (Some(old), Some(new)) = (old.gid, new.gid)
        && old != new
    {
        attributes.push(FimAttribute::Group);
    }
    attributes
}

/// The key of a path: its directory resolved, its last component as given.
pub(crate) fn entry_path(path: &Path) -> PathBuf {
    match (path.parent(), path.file_name()) {
        (Some(parent), Some(name)) => parent
            .canonicalize()
            .map(|parent| parent.join(name))
            .unwrap_or_else(|_| path.to_path_buf()),
        _ => path.to_path_buf(),
    }
}

// Keep aliases such as /var and /private/var consistent with notify events,
// including after deletion when only the parent can still be resolved.
fn baseline_path(path: &Path) -> std::path::PathBuf {
    path.canonicalize()
        .ok()
        .or_else(|| {
            path.parent()?
                .canonicalize()
                .ok()
                .map(|p| p.join(path.file_name().unwrap_or_default()))
        })
        .unwrap_or_else(|| path.to_path_buf())
}

/// Maximum file size for in-memory hashing (64 MB). Larger files use streaming.
const STREAMING_THRESHOLD: u64 = 64 * 1024 * 1024;

/// Compute the baseline for a single file.
pub fn compute_file_baseline(path: &Path) -> Result<FimBaseline, crate::FimError> {
    let metadata = fs::metadata(path)?;
    Ok(baseline_from(path, &metadata)?)
}

/// The baseline entry of a file whose metadata has been read.
///
/// A file the agent is not allowed to read gets an entry without a hash.
fn baseline_from(path: &Path, metadata: &fs::Metadata) -> Result<FimBaseline, std::io::Error> {
    baseline_with_text(path, metadata, false).map(|(baseline, _)| baseline)
}

/// The baseline entry of a file and, when `keep_text` is asked and the file
/// is one a copy may be kept of, its text.
fn baseline_with_text(
    path: &Path,
    metadata: &fs::Metadata,
    keep_text: bool,
) -> Result<(FimBaseline, Option<String>), std::io::Error> {
    let mut text = None;
    let hashed = if metadata.len() > STREAMING_THRESHOLD {
        compute_blake3_streaming(path)
    } else {
        fs::read(path).map(|contents| {
            if keep_text {
                text = crate::content::text_to_keep(path, metadata, &contents).map(str::to_string);
            }
            blake3::hash(&contents).to_hex().to_string()
        })
    };
    let hash = match hashed {
        Ok(hash) => hash,
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => String::new(),
        Err(e) => return Err(e),
    };

    let modified_at = metadata
        .modified()
        .map(chrono::DateTime::<Utc>::from)
        .unwrap_or_else(|_| Utc::now());
    let (uid, gid) = get_owner(metadata);

    let baseline = FimBaseline {
        path: path.to_path_buf(),
        hash,
        permissions: get_permissions(metadata),
        size: metadata.len(),
        modified_at,
        captured_at: Utc::now(),
        uid,
        gid,
    };
    Ok((baseline, text))
}

/// Compute BLAKE3 hash of file contents (streaming for large files).
pub fn compute_blake3(path: &Path) -> Result<String, std::io::Error> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > STREAMING_THRESHOLD {
        compute_blake3_streaming(path)
    } else {
        let contents = fs::read(path)?;
        Ok(blake3::hash(&contents).to_hex().to_string())
    }
}

/// Streaming BLAKE3 hash for large files — avoids loading entire file into memory.
fn compute_blake3_streaming(path: &Path) -> Result<String, std::io::Error> {
    use std::io::Read;
    let mut file = fs::File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0u8; 64 * 1024]; // 64 KB read buffer
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

/// Compute SHA-256 hash for compliance proofs (streaming to avoid loading entire file into memory).
pub fn compute_sha256_proof(path: &Path) -> Result<String, std::io::Error> {
    use sha2::{Digest, Sha256};
    use std::io::{BufReader, Read};
    let file = std::fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let hash = hasher.finalize();
    Ok(hex::encode(hash))
}

/// Get file permissions as a u32.
fn get_permissions(metadata: &fs::Metadata) -> u32 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode()
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        0
    }
}

/// Owning user and group of a file (Unix only).
fn get_owner(metadata: &fs::Metadata) -> (Option<u32>, Option<u32>) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        (Some(metadata.uid()), Some(metadata.gid()))
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        (None, None)
    }
}

/// Check if a path matches any ignore pattern.
///
/// Matching is case-insensitive with normalized separators, mirroring
/// `watcher::is_ignored_path`. The baseline and the watcher must agree: if the
/// baseline hashed a file the watcher ignores (or vice versa), the agent would
/// alert on its own excluded paths.
fn is_ignored(path: &Path, patterns: &[String]) -> bool {
    let path_norm = path.to_string_lossy().to_lowercase().replace('\\', "/");
    for pattern in patterns {
        let pattern_norm = pattern.to_lowercase().replace('\\', "/");
        // Simple glob matching for common patterns
        if let Some(suffix) = pattern_norm.strip_prefix('*') {
            if path_norm.ends_with(suffix) {
                return true;
            }
        } else if let Some(prefix) = pattern_norm.strip_suffix("/**") {
            if path_norm.contains(prefix) {
                return true;
            }
        } else if path_norm.contains(&pattern_norm) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn baseline_alias_and_deleted_path_keep_the_same_identity() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        std::fs::create_dir(&real).unwrap();
        let alias = dir.path().join("alias");
        std::os::unix::fs::symlink(&real, &alias).unwrap();
        let path = real.join("file.txt");
        std::fs::write(&path, "content").unwrap();
        let manager = BaselineManager::new();
        manager.create_baseline(&alias, &[]).unwrap();
        assert!(manager.get(&path).is_some());
        assert!(manager.get(&alias.join("file.txt")).is_some());
        std::fs::remove_file(&path).unwrap();
        assert!(manager.remove(&alias.join("file.txt")).is_some());
        assert_eq!(manager.count(), 0);
    }
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_compute_blake3() {
        let mut tmp = NamedTempFile::new().unwrap();
        tmp.write_all(b"hello world").unwrap();
        tmp.flush().unwrap();

        let hash = compute_blake3(tmp.path()).unwrap();
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // BLAKE3 output is 32 bytes = 64 hex chars
    }

    #[test]
    fn test_compute_file_baseline() {
        let mut tmp = NamedTempFile::new().unwrap();
        tmp.write_all(b"test content").unwrap();
        tmp.flush().unwrap();

        let baseline = compute_file_baseline(tmp.path()).unwrap();
        assert_eq!(baseline.size, 12);
        assert!(!baseline.hash.is_empty());
    }

    #[test]
    fn test_baseline_manager() {
        let mgr = BaselineManager::new();
        assert_eq!(mgr.count(), 0);

        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        mgr.create_baseline(dir.path(), &[]).unwrap();
        assert!(mgr.count() > 0);
        assert!(mgr.get(&file_path).is_some());
    }

    #[test]
    fn test_is_ignored() {
        let patterns = vec!["*.log".to_string(), ".git/**".to_string()];

        assert!(is_ignored(Path::new("/var/log/app.log"), &patterns));
        assert!(is_ignored(Path::new("/repo/.git/objects/abc"), &patterns));
        assert!(!is_ignored(Path::new("/etc/hosts"), &patterns));
    }

    /// A directory by its resolved path, and a baseline manager.
    fn watched() -> (tempfile::TempDir, PathBuf, BaselineManager) {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        (dir, root, BaselineManager::new())
    }

    fn scan(manager: &BaselineManager, root: &Path) -> Vec<Observation> {
        manager.scan(&[root.to_path_buf()], &[], true).changes
    }

    #[test]
    fn a_scan_reports_what_changed_since_the_baseline_was_taken() {
        let (_dir, root, manager) = watched();
        fs::write(root.join("kept"), "same").unwrap();
        fs::write(root.join("edited"), "before").unwrap();
        fs::write(root.join("removed"), "gone soon").unwrap();
        // The first scan records everything: on an empty baseline every file
        // is new, which the engine does not report.
        assert_eq!(scan(&manager, &root).len(), 3);
        assert!(scan(&manager, &root).is_empty());

        fs::write(root.join("edited"), "after").unwrap();
        fs::remove_file(root.join("removed")).unwrap();
        fs::write(root.join("added"), "new").unwrap();

        let mut found: Vec<(String, FimChangeType)> = scan(&manager, &root)
            .into_iter()
            .filter_map(|change| change.into_alert(FimDetection::Rescan))
            .map(|alert| {
                assert_eq!(alert.detection, FimDetection::Rescan);
                let name = alert
                    .path
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .to_string();
                (name, alert.change)
            })
            .collect();
        found.sort_by(|a, b| a.0.cmp(&b.0));
        assert_eq!(
            found,
            vec![
                ("added".to_string(), FimChangeType::Created),
                ("edited".to_string(), FimChangeType::Modified),
                ("removed".to_string(), FimChangeType::Deleted),
            ]
        );
        // Each difference is recorded as it is reported: it is found once.
        assert!(scan(&manager, &root).is_empty());
        assert_eq!(manager.count(), 3);
    }

    #[test]
    fn a_changed_file_carries_the_hash_indicator_feeds_are_keyed_by() {
        let (_dir, root, manager) = watched();
        let path = root.join("dropped.bin");
        fs::write(&path, "hello").unwrap();

        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Realtime)
            .unwrap();
        assert_eq!(alert.change, FimChangeType::Created);
        assert_eq!(
            alert.new_sha256.as_deref(),
            Some("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
        );
        assert_eq!(alert.new_size, Some(5));
    }

    #[test]
    fn a_rewrite_with_the_same_bytes_is_not_a_change() {
        let (_dir, root, manager) = watched();
        let path = root.join("config");
        fs::write(&path, "unchanged").unwrap();
        manager.observe(&path);
        let recorded = manager.get(&path).unwrap().modified_at;

        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&path, "unchanged").unwrap();
        assert!(!manager.observe(&path).is_change());
        // The new modification time is recorded all the same.
        assert!(manager.get(&path).unwrap().modified_at > recorded);
    }

    #[cfg(unix)]
    #[test]
    fn a_permission_change_is_told_apart_from_a_content_change() {
        use std::os::unix::fs::PermissionsExt;
        let (_dir, root, manager) = watched();
        let path = root.join("script.sh");
        fs::write(&path, "#!/bin/sh").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        manager.observe(&path);

        fs::set_permissions(&path, fs::Permissions::from_mode(0o4755)).unwrap();
        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Rescan)
            .unwrap();
        assert_eq!(alert.change, FimChangeType::PermissionChanged);
        assert_eq!(alert.changed_attributes, vec![FimAttribute::Permissions]);
        assert_eq!(alert.old_permissions.map(|mode| mode & 0o7777), Some(0o644));
        assert_eq!(
            alert.new_permissions.map(|mode| mode & 0o7777),
            Some(0o4755)
        );
        // The contents were not read again for a change that is not theirs.
        assert!(alert.new_sha256.is_none());
        assert!(alert.old_owner.is_none() && alert.new_owner.is_none());

        // Contents and permissions together: one alert, both named.
        fs::write(&path, "#!/bin/sh\nid").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Rescan)
            .unwrap();
        assert_eq!(alert.change, FimChangeType::Modified);
        assert_eq!(
            alert.changed_attributes,
            vec![FimAttribute::Content, FimAttribute::Permissions]
        );
        assert!(alert.new_sha256.is_some());
    }

    /// `/etc/shadow` or `/etc/sudoers` for a service that is not root: the
    /// file cannot be hashed, and used not to be followed at all.
    #[cfg(unix)]
    #[test]
    fn a_file_the_agent_may_not_read_is_followed_by_size_and_time() {
        use std::os::unix::fs::PermissionsExt;
        let (_dir, root, manager) = watched();
        let path = root.join("shadow");
        fs::write(&path, "root:*:1::::::").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o000)).unwrap();
        if fs::read(&path).is_ok() {
            return; // run as root: every file is readable, nothing to test
        }

        assert!(matches!(manager.observe(&path), Observation::Created(_)));
        assert!(manager.get(&path).unwrap().hash.is_empty());
        assert!(!manager.observe(&path).is_change());

        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        fs::write(&path, "root:*:1::::::\nintruder::1::::::").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o000)).unwrap();

        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Startup)
            .unwrap();
        assert_eq!(alert.change, FimChangeType::Modified);
        assert_eq!(alert.changed_attributes, vec![FimAttribute::Content]);
        assert!(alert.old_hash.is_none() && alert.new_hash.is_none());
        assert!(alert.new_sha256.is_none());
    }

    fn with_store() -> (
        tempfile::TempDir,
        tempfile::TempDir,
        PathBuf,
        BaselineManager,
    ) {
        let dir = tempfile::tempdir().unwrap();
        let copies = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let store = crate::content::ContentStore::new(copies.path().join("content"));
        let manager = BaselineManager::new().with_content_store(store);
        (dir, copies, root, manager)
    }

    #[cfg(unix)]
    fn set_mode(path: &Path, mode: u32) {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(mode)).unwrap();
    }

    /// "`/etc/hosts` was modified" sends someone to look; the line that was
    /// added is the finding.
    #[cfg(unix)]
    #[test]
    fn a_changed_text_file_says_which_lines_changed() {
        let (_dir, _copies, root, manager) = with_store();
        let path = root.join("hosts");
        fs::write(&path, "127.0.0.1 localhost\n::1 localhost\n").unwrap();
        set_mode(&path, 0o644);
        assert!(matches!(manager.observe(&path), Observation::Created(_)));

        fs::write(
            &path,
            "127.0.0.1 localhost\n10.0.0.9 update.example\n::1 localhost\n",
        )
        .unwrap();
        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Realtime)
            .unwrap();
        assert_eq!(alert.change, FimChangeType::Modified);
        assert_eq!(
            alert.diff.as_deref(),
            Some("@@ line 2\n+10.0.0.9 update.example\n")
        );
        assert_eq!(
            alert.details()["diff"],
            "@@ line 2\n+10.0.0.9 update.example\n"
        );

        // The next change is compared with what the file became.
        fs::write(&path, "127.0.0.1 localhost\n::1 localhost\n").unwrap();
        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Realtime)
            .unwrap();
        assert_eq!(
            alert.diff.as_deref(),
            Some("@@ line 2\n-10.0.0.9 update.example\n")
        );

        // A change of permissions has no lines to show.
        set_mode(&path, 0o664);
        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Realtime)
            .unwrap();
        assert_eq!(alert.change, FimChangeType::PermissionChanged);
        assert!(alert.diff.is_none());
    }

    /// A file some accounts may not read holds what must not be copied
    /// anywhere: its changes are reported without their lines.
    #[cfg(unix)]
    #[test]
    fn the_contents_of_a_private_file_are_never_kept() {
        let (_dir, _copies, root, manager) = with_store();
        let store = manager.content.as_ref().unwrap();
        let shadow = root.join("shadow");
        fs::write(&shadow, "root:$6$hash:1::::::\n").unwrap();
        set_mode(&shadow, 0o640);
        manager.observe(&shadow);
        assert!(!store.holds(&shadow));
        fs::write(&shadow, "root:$6$other:1::::::\n").unwrap();
        let alert = manager
            .observe(&shadow)
            .into_alert(FimDetection::Realtime)
            .unwrap();
        assert_eq!(alert.change, FimChangeType::Modified);
        assert!(alert.diff.is_none());

        // A file that becomes private has its copy removed, and a program
        // is not text.
        let config = root.join("app.conf");
        fs::write(&config, "token = public\n").unwrap();
        set_mode(&config, 0o644);
        manager.observe(&config);
        assert!(store.holds(&config));
        set_mode(&config, 0o600);
        manager.observe(&config);
        assert!(!store.holds(&config));

        let program = root.join("tool");
        fs::write(&program, [0x7f, b'E', b'L', b'F', 0, 1, 2]).unwrap();
        set_mode(&program, 0o755);
        manager.observe(&program);
        assert!(!store.holds(&program));

        // A deleted file is forgotten.
        let notes = root.join("motd");
        fs::write(&notes, "welcome\n").unwrap();
        set_mode(&notes, 0o644);
        manager.observe(&notes);
        assert!(store.holds(&notes));
        fs::remove_file(&notes).unwrap();
        manager.observe(&notes);
        assert!(!store.holds(&notes));
    }

    /// A baseline taken before contents were kept (an earlier version, or a
    /// restored baseline): the copy is taken at the next reading, and the
    /// change after that one shows its lines.
    #[cfg(unix)]
    #[test]
    fn a_file_known_before_its_contents_were_kept_is_copied_at_the_next_reading() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let path = root.join("resolv.conf");
        fs::write(&path, "nameserver 192.0.2.53\n").unwrap();
        set_mode(&path, 0o644);
        let without = BaselineManager::new();
        without.observe(&path);
        let saved = without.entries();

        let copies = tempfile::tempdir().unwrap();
        let manager = BaselineManager::new().with_content_store(crate::content::ContentStore::new(
            copies.path().join("content"),
        ));
        manager.restore(saved);
        assert!(!manager.observe(&path).is_change());
        assert!(manager.content.as_ref().unwrap().holds(&path));

        fs::write(&path, "nameserver 203.0.113.53\n").unwrap();
        let alert = manager
            .observe(&path)
            .into_alert(FimDetection::Rescan)
            .unwrap();
        assert_eq!(
            alert.diff.as_deref(),
            Some("@@ line 1\n-nameserver 192.0.2.53\n+nameserver 203.0.113.53\n")
        );
    }

    #[test]
    fn entries_of_a_path_no_longer_watched_are_dropped_without_a_word() {
        let (_dir, root, manager) = watched();
        let kept = root.join("kept");
        let dropped = root.join("dropped");
        fs::create_dir_all(&kept).unwrap();
        fs::create_dir_all(&dropped).unwrap();
        fs::write(kept.join("a"), "a").unwrap();
        fs::write(dropped.join("b"), "b").unwrap();
        manager.scan(&[kept.clone(), dropped.clone()], &[], true);
        assert_eq!(manager.count(), 2);

        let report = manager.scan(std::slice::from_ref(&kept), &[], true);
        assert!(report.changes.is_empty());
        assert_eq!(manager.count(), 1);

        // The same for a file that an exclusion now covers.
        let report = manager.scan(&[kept], &["a".to_string()], true);
        assert!(report.changes.is_empty());
        assert_eq!(manager.count(), 0);
    }

    #[test]
    fn the_files_of_a_watched_directory_removed_as_a_whole_are_reported() {
        let (_dir, root, manager) = watched();
        let cron = root.join("cron.d");
        fs::create_dir_all(&cron).unwrap();
        fs::write(cron.join("job"), "* * * * * root true").unwrap();
        manager.scan(std::slice::from_ref(&cron), &[], true);

        fs::remove_dir_all(&cron).unwrap();
        let report = manager.scan(&[cron], &[], true);
        assert_eq!(report.changes.len(), 1);
        assert!(matches!(report.changes[0], Observation::Deleted(_)));
    }

    #[test]
    fn a_restored_baseline_is_compared_like_one_taken_in_this_run() {
        let (_dir, root, manager) = watched();
        fs::write(root.join("hosts"), "127.0.0.1 localhost").unwrap();
        scan(&manager, &root);
        let saved = manager.entries();

        fs::write(
            root.join("hosts"),
            "127.0.0.1 localhost\n10.0.0.9 update.example",
        )
        .unwrap();
        let after_restart = BaselineManager::new();
        after_restart.restore(saved);
        let changes = scan(&after_restart, &root);
        assert_eq!(changes.len(), 1);
        assert!(matches!(changes[0], Observation::Changed { .. }));
    }

    #[test]
    fn the_baseline_knows_when_it_differs_from_the_saved_one() {
        let (_dir, root, manager) = watched();
        assert!(!manager.take_dirty());
        fs::write(root.join("file"), "content").unwrap();
        scan(&manager, &root);
        assert!(manager.take_dirty());
        assert!(!manager.take_dirty());
        scan(&manager, &root);
        assert!(
            !manager.take_dirty(),
            "a scan that finds nothing saves nothing"
        );
    }

    #[test]
    fn test_sha256_proof() {
        let mut tmp = NamedTempFile::new().unwrap();
        tmp.write_all(b"hello").unwrap();
        tmp.flush().unwrap();

        let hash = compute_sha256_proof(tmp.path()).unwrap();
        assert_eq!(hash.len(), 64); // SHA-256 = 32 bytes = 64 hex chars
    }
}
