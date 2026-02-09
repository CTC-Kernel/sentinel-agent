//! Baseline snapshot creation and comparison using BLAKE3.
//!
//! BLAKE3 is used for internal baselines (4x faster than SHA-256).
//! SHA-256 can be computed separately for compliance proofs.

use agent_common::types::FimBaseline;
use chrono::Utc;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use tracing::debug;
use walkdir::WalkDir;

/// Manages file baselines for integrity comparison.
pub struct BaselineManager {
    /// In-memory baseline store: path -> baseline entry.
    baselines: RwLock<HashMap<PathBuf, FimBaseline>>,
}

impl BaselineManager {
    /// Create a new empty baseline manager.
    pub fn new() -> Self {
        Self {
            baselines: RwLock::new(HashMap::new()),
        }
    }

    /// Create a baseline for all files under the given path.
    ///
    /// Returns the number of files baselined.
    pub fn create_baseline(
        &self,
        root: &Path,
        ignore_patterns: &[String],
    ) -> Result<usize, crate::FimError> {
        let mut count = 0;
        let mut baselines = self
            .baselines
            .write()
            .map_err(|e| crate::FimError::Baseline(format!("Lock poisoned: {}", e)))?;

        let walker = WalkDir::new(root)
            .follow_links(false)
            .max_depth(5) // Limit recursion depth for performance
            .into_iter()
            .filter_entry(|e| !is_ignored(e.path(), ignore_patterns));

        for entry in walker {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path().to_path_buf();

            match compute_file_baseline(&path) {
                Ok(baseline) => {
                    baselines.insert(path, baseline);
                    count += 1;
                }
                Err(e) => {
                    debug!("Skipping {}: {}", entry.path().display(), e);
                }
            }
        }

        Ok(count)
    }

    /// Look up the baseline for a given path.
    pub fn get(&self, path: &Path) -> Option<FimBaseline> {
        self.baselines
            .read()
            .ok()
            .and_then(|b| b.get(path).cloned())
    }

    /// Update the baseline for a specific file.
    pub fn update(&self, path: &Path) -> Result<Option<FimBaseline>, crate::FimError> {
        let new_baseline = compute_file_baseline(path)?;
        let mut baselines = self
            .baselines
            .write()
            .map_err(|e| crate::FimError::Baseline(format!("Lock poisoned: {}", e)))?;

        let old = baselines.insert(path.to_path_buf(), new_baseline);
        Ok(old)
    }

    /// Remove a path from the baseline (e.g., when file is deleted).
    pub fn remove(&self, path: &Path) -> Option<FimBaseline> {
        self.baselines.write().ok().and_then(|mut b| b.remove(path))
    }

    /// Get the total number of baselined files.
    pub fn count(&self) -> usize {
        self.baselines.read().map(|b| b.len()).unwrap_or(0)
    }
}

impl Default for BaselineManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Maximum file size for in-memory hashing (64 MB). Larger files use streaming.
const STREAMING_THRESHOLD: u64 = 64 * 1024 * 1024;

/// Compute the baseline for a single file.
pub fn compute_file_baseline(path: &Path) -> Result<FimBaseline, crate::FimError> {
    let metadata = fs::metadata(path)?;

    let hash = if metadata.len() > STREAMING_THRESHOLD {
        compute_blake3_streaming(path)?
    } else {
        let contents = fs::read(path)?;
        blake3::hash(&contents).to_hex().to_string()
    };

    let permissions = get_permissions(&metadata);
    let modified_at = metadata
        .modified()
        .map(chrono::DateTime::<Utc>::from)
        .unwrap_or_else(|_| Utc::now());

    Ok(FimBaseline {
        path: path.to_path_buf(),
        hash,
        permissions,
        size: metadata.len(),
        modified_at,
        captured_at: Utc::now(),
    })
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

/// Check if a path matches any ignore pattern.
fn is_ignored(path: &Path, patterns: &[String]) -> bool {
    let path_str = path.to_string_lossy();
    for pattern in patterns {
        // Simple glob matching for common patterns
        if let Some(suffix) = pattern.strip_prefix('*') {
            if path_str.ends_with(suffix) {
                return true;
            }
        } else if let Some(prefix) = pattern.strip_suffix("/**") {
            if path_str.contains(prefix) {
                return true;
            }
        } else if path_str.contains(pattern.as_str()) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
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

    #[test]
    fn test_sha256_proof() {
        let mut tmp = NamedTempFile::new().unwrap();
        tmp.write_all(b"hello").unwrap();
        tmp.flush().unwrap();

        let hash = compute_sha256_proof(tmp.path()).unwrap();
        assert_eq!(hash.len(), 64); // SHA-256 = 32 bytes = 64 hex chars
    }
}
