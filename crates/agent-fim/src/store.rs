// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The baseline kept between two runs of the agent.
//!
//! A baseline rebuilt at every start adopts, without a word, whatever was
//! changed while the agent was stopped: stopping the agent, editing
//! `/etc/sudoers` and starting it again left no trace. The baseline saved
//! here is what the files are compared with at the next start.
//!
//! # Trust
//!
//! The file is as trustworthy as the directory it is in. It is written in
//! the agent's data directory, readable and writable by the agent's account
//! only. An account able to rewrite it is also able to stop the agent or
//! replace its binary: the saved baseline protects against changes made
//! while the agent is not running, not against whoever controls the agent.
//! A saved baseline that cannot be read is reported, never silently replaced.

use agent_common::types::FimBaseline;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Format of the saved baseline. A file of another version is not read.
pub const SNAPSHOT_VERSION: u32 = 1;

/// Largest saved baseline read (a full baseline is a few tens of megabytes).
const MAX_SNAPSHOT_BYTES: u64 = 256 * 1024 * 1024;

/// What a baseline was built from.
///
/// A file absent from a baseline is only a new file if its directory was
/// already watched, under the same exclusions. Otherwise it is a file the
/// baseline never looked at.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Coverage {
    /// Watched paths, resolved.
    pub roots: Vec<PathBuf>,
    /// Exclusion patterns, sorted.
    pub ignore_patterns: Vec<String>,
}

impl Coverage {
    pub fn new(roots: &[PathBuf], ignore_patterns: &[String]) -> Self {
        let mut roots: Vec<PathBuf> = roots
            .iter()
            .map(|root| root.canonicalize().unwrap_or_else(|_| root.clone()))
            .collect();
        roots.sort();
        roots.dedup();
        let mut ignore_patterns = ignore_patterns.to_vec();
        ignore_patterns.sort();
        ignore_patterns.dedup();
        Self {
            roots,
            ignore_patterns,
        }
    }

    /// Whether a baseline built from `self` would have held `path`, had it
    /// existed, given what is watched `now`.
    pub fn knew(&self, path: &Path, now: &Coverage) -> bool {
        self.ignore_patterns == now.ignore_patterns
            && self.roots.iter().any(|root| path.starts_with(root))
    }
}

/// A baseline as saved on disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: u32,
    pub saved_at: DateTime<Utc>,
    #[serde(flatten)]
    pub coverage: Coverage,
    pub entries: Vec<FimBaseline>,
}

impl Snapshot {
    pub fn new(coverage: Coverage, entries: Vec<FimBaseline>) -> Self {
        Self {
            version: SNAPSHOT_VERSION,
            saved_at: Utc::now(),
            coverage,
            entries,
        }
    }
}

/// Read the saved baseline.
///
/// `Ok(None)` when there is none (first run). `Err` with the reason when
/// there is one that cannot be used: the caller reports it, because the
/// changes made since it was written can then no longer be found.
pub fn load(path: &Path) -> Result<Option<Snapshot>, String> {
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("cannot be read: {e}")),
    };
    if metadata.len() > MAX_SNAPSHOT_BYTES {
        return Err(format!("is too large ({} bytes)", metadata.len()));
    }
    let bytes = std::fs::read(path).map_err(|e| format!("cannot be read: {e}"))?;
    let snapshot: Snapshot =
        serde_json::from_slice(&bytes).map_err(|e| format!("is not a valid baseline: {e}"))?;
    if snapshot.version != SNAPSHOT_VERSION {
        return Err(format!(
            "has format version {} (expected {})",
            snapshot.version, SNAPSHOT_VERSION
        ));
    }
    Ok(Some(snapshot))
}

fn create_private(path: &Path) -> std::io::Result<std::fs::File> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

/// Save the baseline: written beside its destination, then moved over it, so
/// a crash never leaves half a baseline.
pub fn save(path: &Path, snapshot: &Snapshot) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);

    let written = (|| {
        let mut file = std::io::BufWriter::new(create_private(&tmp)?);
        serde_json::to_writer(&mut file, snapshot).map_err(std::io::Error::other)?;
        let file = file.into_inner().map_err(|e| e.into_error())?;
        file.sync_all()
    })();
    if let Err(e) = written.and_then(|()| std::fs::rename(&tmp, path)) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(path: &str) -> FimBaseline {
        FimBaseline {
            path: PathBuf::from(path),
            hash: "abc".to_string(),
            permissions: 0o100644,
            size: 3,
            modified_at: Utc::now(),
            captured_at: Utc::now(),
            uid: Some(0),
            gid: Some(0),
        }
    }

    fn coverage(roots: &[&str], patterns: &[&str]) -> Coverage {
        Coverage {
            roots: roots.iter().map(PathBuf::from).collect(),
            ignore_patterns: patterns.iter().map(|p| (*p).to_string()).collect(),
        }
    }

    #[test]
    fn a_saved_baseline_is_read_back_identical() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("fim").join("baseline.json");
        let saved = Snapshot::new(
            coverage(&["/etc"], &["*.log"]),
            vec![entry("/etc/hosts"), entry("/etc/passwd")],
        );
        save(&path, &saved).unwrap();

        let read = load(&path).unwrap().expect("a baseline was saved");
        assert_eq!(read.coverage, saved.coverage);
        assert_eq!(read.entries.len(), 2);
        assert_eq!(read.entries[0].path, PathBuf::from("/etc/hosts"));
        // The modification time is what stands for the contents of a file
        // the agent may not read: it must survive the round trip exactly.
        assert_eq!(read.entries[0].modified_at, saved.entries[0].modified_at);
        assert!(!dir.path().join("fim").join("baseline.json.tmp").exists());
    }

    #[cfg(unix)]
    #[test]
    fn the_saved_baseline_is_private_to_the_agent() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("baseline.json");
        save(&path, &Snapshot::new(Coverage::default(), vec![])).unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn no_saved_baseline_is_a_first_run_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load(&dir.path().join("absent.json")).unwrap().is_none());
    }

    #[test]
    fn an_unusable_baseline_is_reported_with_the_reason() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("baseline.json");

        std::fs::write(&path, "{ truncated").unwrap();
        assert!(load(&path).unwrap_err().contains("not a valid baseline"));

        let mut other_version = Snapshot::new(Coverage::default(), vec![]);
        other_version.version = SNAPSHOT_VERSION + 1;
        std::fs::write(&path, serde_json::to_vec(&other_version).unwrap()).unwrap();
        assert!(load(&path).unwrap_err().contains("format version"));
    }

    #[test]
    fn a_file_is_new_only_where_the_baseline_already_looked() {
        let before = coverage(&["/etc"], &["*.log"]);

        // Same watch, same exclusions: a file absent from the baseline is new.
        let same = coverage(&["/etc"], &["*.log"]);
        assert!(before.knew(Path::new("/etc/cron.d/job"), &same));

        // A path watched since: its files were never looked at.
        let wider = coverage(&["/etc", "/opt/app"], &["*.log"]);
        assert!(!before.knew(Path::new("/opt/app/run.sh"), &wider));
        assert!(before.knew(Path::new("/etc/cron.d/job"), &wider));

        // Exclusions changed: the file may only have stopped being ignored.
        let other_exclusions = coverage(&["/etc"], &[]);
        assert!(!before.knew(Path::new("/etc/app.log"), &other_exclusions));
    }

    #[test]
    fn coverage_does_not_depend_on_the_order_things_are_declared_in() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a");
        let b = dir.path().join("b");
        std::fs::create_dir_all(&a).unwrap();
        std::fs::create_dir_all(&b).unwrap();
        let patterns = ["*.tmp".to_string(), "*.log".to_string()];
        let reversed = ["*.log".to_string(), "*.tmp".to_string()];
        assert_eq!(
            Coverage::new(&[a.clone(), b.clone()], &patterns),
            Coverage::new(&[b, a.clone(), a], &reversed)
        );
    }
}
