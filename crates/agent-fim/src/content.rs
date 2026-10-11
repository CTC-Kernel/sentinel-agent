// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What changed inside a file, not only that it changed.
//!
//! "`/etc/hosts` was modified" sends someone to look at the file; "a line
//! `10.0.0.9 update.example` was added" is the finding. To say it, the last
//! known contents of the small text files are kept, and compared line by
//! line with the new contents when the file changes.
//!
//! # What is kept, and what is not
//!
//! A copy is kept only of a file that is:
//!
//! - small ([`MAX_FILE_BYTES`]) and text (valid UTF-8, no NUL byte);
//! - readable by every account of the system (Unix). A file whose
//!   permissions keep it from some accounts — `/etc/shadow`, a private key,
//!   `/etc/sudoers` — is never copied: its contents are not for a second
//!   place to hold. A file that stops being readable by everyone has its
//!   copy removed.
//!
//! On Windows, where permission bits do not say this, a file is left out by
//! its name (keys, certificates stores, registry hives).
//!
//! The copies are in the agent's data directory, private to the agent, and
//! bounded in total size ([`MAX_STORE_BYTES`]).

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use tracing::debug;

/// Largest file a copy is kept of.
pub const MAX_FILE_BYTES: u64 = 256 * 1024;
/// Total size of the copies kept.
pub const MAX_STORE_BYTES: u64 = 256 * 1024 * 1024;
/// Longest difference reported; the rest is cut.
pub const MAX_DIFF_CHARS: usize = 4_000;
/// Longest file compared line by line, in lines, once what the two versions
/// share at their start and end has been set aside.
const MAX_DIFF_LINES: usize = 2_000;

/// File names never copied on a system without permission bits.
#[cfg(not(unix))]
const PRIVATE_NAMES: &[&str] = &[
    ".key",
    ".pem",
    ".pfx",
    ".p12",
    ".kdbx",
    "\\config\\sam",
    "\\config\\security",
    "\\config\\system",
    "\\config\\software",
    "ntds.dit",
];

/// The contents last seen of the files that may be copied.
pub struct ContentStore {
    dir: PathBuf,
    /// Bytes held, as far as this run knows.
    used: AtomicU64,
}

/// The text of a file when a copy of it may be kept.
pub fn text_to_keep<'a>(
    path: &Path,
    metadata: &std::fs::Metadata,
    content: &'a [u8],
) -> Option<&'a str> {
    if content.len() as u64 > MAX_FILE_BYTES || content.contains(&0) {
        return None;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = path;
        if metadata.permissions().mode() & 0o004 == 0 {
            return None;
        }
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        let name = path.to_string_lossy().to_lowercase();
        if PRIVATE_NAMES.iter().any(|private| name.contains(private)) {
            return None;
        }
    }
    std::str::from_utf8(content).ok()
}

impl ContentStore {
    /// A store keeping its copies in `dir`.
    pub fn new(dir: PathBuf) -> Self {
        let used = std::fs::read_dir(&dir)
            .map(|entries| {
                entries
                    .flatten()
                    .filter_map(|entry| entry.metadata().ok())
                    .map(|metadata| metadata.len())
                    .sum()
            })
            .unwrap_or(0);
        Self {
            dir,
            used: AtomicU64::new(used),
        }
    }

    /// Where the copy of a file is kept: a name derived from its path, so
    /// the store says nothing of what is watched to who lists it.
    fn slot(&self, path: &Path) -> PathBuf {
        let name = blake3::hash(path.to_string_lossy().as_bytes()).to_hex();
        self.dir.join(name.as_str())
    }

    /// The contents last kept of a file.
    pub fn previous(&self, path: &Path) -> Option<String> {
        std::fs::read_to_string(self.slot(path)).ok()
    }

    /// Whether a copy of the file is kept.
    pub fn holds(&self, path: &Path) -> bool {
        self.slot(path).exists()
    }

    /// Keep these contents as the last seen of the file.
    pub fn remember(&self, path: &Path, text: &str) {
        let slot = self.slot(path);
        let before = std::fs::metadata(&slot).map(|m| m.len()).unwrap_or(0);
        let used = self.used.load(Ordering::Relaxed).saturating_sub(before);
        if used + text.len() as u64 > MAX_STORE_BYTES {
            debug!(
                "FIM content store is full: {} is not copied",
                path.display()
            );
            self.forget(path);
            return;
        }
        let written = (|| -> std::io::Result<()> {
            std::fs::create_dir_all(&self.dir)?;
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create(true).truncate(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            std::io::Write::write_all(&mut options.open(&slot)?, text.as_bytes())
        })();
        match written {
            Ok(()) => self.used.store(used + text.len() as u64, Ordering::Relaxed),
            Err(e) => debug!("FIM content of {} not kept: {}", path.display(), e),
        }
    }

    /// Stop keeping a copy of the file.
    pub fn forget(&self, path: &Path) {
        let slot = self.slot(path);
        if let Ok(metadata) = std::fs::metadata(&slot)
            && std::fs::remove_file(&slot).is_ok()
        {
            let used = self.used.load(Ordering::Relaxed);
            self.used
                .store(used.saturating_sub(metadata.len()), Ordering::Relaxed);
        }
    }
}

/// The lines removed and added between two texts, with the line number each
/// group starts at:
///
/// ```text
/// @@ line 3
/// -127.0.1.1 old-name
/// +127.0.1.1 new-name
/// +10.0.0.9 update.example
/// ```
///
/// `None` when the texts have the same lines.
pub fn diff_lines(old: &str, new: &str) -> Option<String> {
    let old_lines: Vec<&str> = old.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();

    // What the two versions share at their start and end is not compared:
    // an edit touches a few lines of a file.
    let prefix = old_lines
        .iter()
        .zip(&new_lines)
        .take_while(|(a, b)| a == b)
        .count();
    let suffix = old_lines[prefix..]
        .iter()
        .rev()
        .zip(new_lines[prefix..].iter().rev())
        .take_while(|(a, b)| a == b)
        .count();
    let old_mid = &old_lines[prefix..old_lines.len() - suffix];
    let new_mid = &new_lines[prefix..new_lines.len() - suffix];
    if old_mid.is_empty() && new_mid.is_empty() {
        return None;
    }

    let mut out = String::new();
    if old_mid.len() > MAX_DIFF_LINES || new_mid.len() > MAX_DIFF_LINES {
        out.push_str(&format!(
            "@@ line {}\n({} lines replaced by {}: too many to list)\n",
            prefix + 1,
            old_mid.len(),
            new_mid.len()
        ));
        return Some(out);
    }

    // Longest common subsequence of the lines in between, then a walk back
    // through the table gives the lines only one version has.
    let (rows, columns) = (old_mid.len(), new_mid.len());
    let mut table = vec![0u32; (rows + 1) * (columns + 1)];
    let at = |row: usize, column: usize| row * (columns + 1) + column;
    for row in (0..rows).rev() {
        for column in (0..columns).rev() {
            table[at(row, column)] = if old_mid[row] == new_mid[column] {
                table[at(row + 1, column + 1)] + 1
            } else {
                table[at(row + 1, column)].max(table[at(row, column + 1)])
            };
        }
    }
    let (mut row, mut column) = (0, 0);
    let mut in_group = false;
    while row < rows || column < columns {
        if row < rows && column < columns && old_mid[row] == new_mid[column] {
            row += 1;
            column += 1;
            in_group = false;
            continue;
        }
        if !in_group {
            out.push_str(&format!("@@ line {}\n", prefix + column + 1));
            in_group = true;
        }
        let remove = column >= columns
            || (row < rows && table[at(row + 1, column)] >= table[at(row, column + 1)]);
        if remove {
            out.push_str(&format!("-{}\n", old_mid[row]));
            row += 1;
        } else {
            out.push_str(&format!("+{}\n", new_mid[column]));
            column += 1;
        }
        if out.len() > MAX_DIFF_CHARS {
            let cut = out
                .char_indices()
                .take_while(|(index, _)| *index <= MAX_DIFF_CHARS)
                .last()
                .map_or(0, |(index, c)| index + c.len_utf8());
            out.truncate(cut);
            out.push_str("\n… (the rest of the difference is not shown)\n");
            break;
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_lines_added_and_removed_are_given_with_where_they_are() {
        let old = "127.0.0.1 localhost\n::1 localhost\n127.0.1.1 old-name\n# end\n";
        let new = "127.0.0.1 localhost\n::1 localhost\n127.0.1.1 new-name\n10.0.0.9 update.example\n# end\n";
        assert_eq!(
            diff_lines(old, new).unwrap(),
            "@@ line 3\n-127.0.1.1 old-name\n+127.0.1.1 new-name\n+10.0.0.9 update.example\n"
        );
        // Appended, removed, and two separate edits.
        assert_eq!(
            diff_lines("a\nb\n", "a\nb\nc\n").unwrap(),
            "@@ line 3\n+c\n"
        );
        assert_eq!(
            diff_lines("a\nb\nc\n", "a\nc\n").unwrap(),
            "@@ line 2\n-b\n"
        );
        assert_eq!(
            diff_lines("a\nb\nc\nd\ne\n", "a\nB\nc\nd\nE\n").unwrap(),
            "@@ line 2\n-b\n+B\n@@ line 5\n-e\n+E\n"
        );
        assert_eq!(diff_lines("", "first\n").unwrap(), "@@ line 1\n+first\n");
        // The same lines: no difference, whatever the last line ending.
        assert_eq!(diff_lines("a\nb\n", "a\nb"), None);
    }

    #[test]
    fn a_long_difference_is_cut_and_a_huge_one_summarised() {
        let old: String = (0..500).map(|n| format!("old line number {n}\n")).collect();
        let new: String = (0..500).map(|n| format!("new line number {n}\n")).collect();
        let diff = diff_lines(&old, &new).unwrap();
        assert!(diff.len() < MAX_DIFF_CHARS + 200);
        assert!(diff.ends_with("(the rest of the difference is not shown)\n"));

        let old: String = (0..MAX_DIFF_LINES + 10)
            .map(|n| format!("a{n}\n"))
            .collect();
        let new: String = (0..MAX_DIFF_LINES + 10)
            .map(|n| format!("b{n}\n"))
            .collect();
        assert!(diff_lines(&old, &new).unwrap().contains("too many to list"));
    }

    fn metadata_of(path: &Path) -> std::fs::Metadata {
        std::fs::metadata(path).unwrap()
    }

    #[test]
    fn only_small_text_files_everyone_may_read_are_copied() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("hosts");
        std::fs::write(&path, "127.0.0.1 localhost\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        }
        let metadata = metadata_of(&path);
        assert_eq!(
            text_to_keep(&path, &metadata, b"127.0.0.1 localhost\n"),
            Some("127.0.0.1 localhost\n")
        );
        // Not text, or too large.
        assert_eq!(text_to_keep(&path, &metadata, b"\x7fELF\0\0"), None);
        assert_eq!(text_to_keep(&path, &metadata, &[0xff, 0xfe, 0x41]), None);
        let large = vec![b'a'; MAX_FILE_BYTES as usize + 1];
        assert_eq!(text_to_keep(&path, &metadata, &large), None);

        // A file some accounts may not read holds what is not to be copied.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o640)).unwrap();
            assert_eq!(text_to_keep(&path, &metadata_of(&path), b"root:hash"), None);
        }
    }

    #[test]
    fn the_store_keeps_replaces_and_forgets() {
        let dir = tempfile::tempdir().unwrap();
        let store = ContentStore::new(dir.path().join("content"));
        let path = Path::new("/etc/hosts");
        assert!(store.previous(path).is_none() && !store.holds(path));

        store.remember(path, "one\n");
        assert_eq!(store.previous(path).as_deref(), Some("one\n"));
        store.remember(path, "one\ntwo\n");
        assert_eq!(store.previous(path).as_deref(), Some("one\ntwo\n"));
        assert_eq!(store.used.load(Ordering::Relaxed), 8);

        // The copy is private, and its name does not give the path away.
        let entries: Vec<_> = std::fs::read_dir(dir.path().join("content"))
            .unwrap()
            .flatten()
            .collect();
        assert_eq!(entries.len(), 1);
        assert!(!entries[0].file_name().to_string_lossy().contains("hosts"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = entries[0].metadata().unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }

        // A store opened again knows what it already holds.
        let reopened = ContentStore::new(dir.path().join("content"));
        assert_eq!(reopened.used.load(Ordering::Relaxed), 8);

        store.forget(path);
        assert!(!store.holds(path));
        assert_eq!(store.used.load(Ordering::Relaxed), 0);
    }
}
