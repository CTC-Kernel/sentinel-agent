// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Following log files: the lines written since the last reading.
//!
//! The system logs do not hold everything: a web server writes its access
//! log, an application its own file. The files declared in `log_files` are
//! read as they grow and their lines decoded ([`crate::decode`]).
//!
//! # What is guaranteed
//!
//! - A file followed for the first time is read from its end: its history is
//!   not replayed as if it had just happened.
//! - The position in each file is kept on disk: lines written while the
//!   agent was stopped are read at the next start.
//! - A rotated file (renamed, a new one created in its place) is read to its
//!   end, then the new one from its start. A file truncated in place is read
//!   from its start.
//! - One reading takes at most [`MAX_BYTES_PER_READ`] from a file, so a file
//!   that grew a lot is caught up over several readings, and a line longer
//!   than [`MAX_LINE_BYTES`] is cut.

use crate::decode::{self, DecodedLog};
use agent_common::config::{LogFileConfig, LogFileFormat};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use tracing::{debug, warn};

/// Bytes read at most from one file in one reading.
pub const MAX_BYTES_PER_READ: u64 = 4 * 1024 * 1024;
/// Longest line decoded; the rest of a longer line is dropped.
pub const MAX_LINE_BYTES: usize = 64 * 1024;
/// Files followed at most.
pub const MAX_FILES: usize = 64;

/// What tells a file from the one that replaces it under the same name.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
struct FileIdentity {
    device: u64,
    inode: u64,
}

fn identity(metadata: &std::fs::Metadata) -> Option<FileIdentity> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Some(FileIdentity {
            device: metadata.dev(),
            inode: metadata.ino(),
        })
    }
    #[cfg(not(unix))]
    {
        // Without a stable identifier, only a file that shrank is known to
        // have been replaced.
        let _ = metadata;
        None
    }
}

/// Where the reading of a file stopped.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
struct Position {
    #[serde(default)]
    identity: Option<FileIdentity>,
    offset: u64,
}

/// Positions kept on disk between two runs, by path.
#[derive(Debug, Default, Serialize, Deserialize)]
struct Positions {
    #[serde(default)]
    files: BTreeMap<String, Position>,
}

struct Followed {
    spec: LogFileConfig,
    service: String,
    file: Option<File>,
    position: Option<Position>,
    /// The start of a line whose end has not been written yet.
    partial: Vec<u8>,
    /// Whether the rest of the current line is being dropped (too long).
    skipping: bool,
    /// Whether the last opening failed, to report it once.
    unreadable: bool,
    /// Whether the file was seen not to exist: when it appears, all of it
    /// was written while it was followed.
    seen_absent: bool,
}

/// The name rules know a file by when none is declared: its name without
/// its extension (`/var/log/nginx/access.log` is `access`).
fn default_service(path: &Path) -> String {
    path.file_stem()
        .map(|stem| stem.to_string_lossy().to_ascii_lowercase())
        .filter(|stem| !stem.is_empty())
        .unwrap_or_else(|| "file".to_string())
}

/// Decode one line of a file according to its declared format. A line the
/// format does not recognise is kept as text.
fn decode_line(line: &str, format: LogFileFormat, service: &str) -> DecodedLog {
    let decoded = match format {
        LogFileFormat::Syslog => decode::decode_syslog_line(line),
        LogFileFormat::Json => decode::decode_json_line(line),
        LogFileFormat::Web => decode::decode_access_line(line),
        LogFileFormat::Audit => decode::decode_audit_line(line),
        LogFileFormat::Text => None,
    };
    let mut log = decoded.unwrap_or_else(|| decode::decode_text_line(line));
    if !log.services.iter().any(|known| known == service) {
        log.services.push(service.to_string());
    }
    log
}

/// Follows the declared log files.
pub struct LogFileTailer {
    files: Vec<Followed>,
    state_path: Option<PathBuf>,
    saved: Positions,
}

impl LogFileTailer {
    /// Follow `specs`, keeping the positions in `state_path` (in memory only
    /// without it). A relative path, or a path declared twice, is left out
    /// with the reason.
    pub fn new(specs: &[LogFileConfig], state_path: Option<PathBuf>) -> (Self, Vec<String>) {
        let saved: Positions = state_path
            .as_deref()
            .and_then(|path| std::fs::read(path).ok())
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        let mut tailer = Self {
            files: Vec::new(),
            state_path,
            saved,
        };
        let errors = specs
            .iter()
            .filter_map(|spec| tailer.follow(spec).err())
            .collect();
        (tailer, errors)
    }

    /// Follow one more file.
    pub fn follow(&mut self, spec: &LogFileConfig) -> Result<(), String> {
        let path = Path::new(&spec.path);
        if !path.is_absolute() {
            return Err(format!("{}: not an absolute path", spec.path));
        }
        if self.is_following(&spec.path) {
            return Err(format!("{}: declared twice", spec.path));
        }
        if self.files.len() >= MAX_FILES {
            return Err(format!(
                "{}: more than {MAX_FILES} files declared",
                spec.path
            ));
        }
        let service = spec
            .service
            .as_deref()
            .map(|service| service.trim().to_ascii_lowercase())
            .filter(|service| !service.is_empty())
            .unwrap_or_else(|| default_service(path));
        self.files.push(Followed {
            spec: spec.clone(),
            service,
            file: None,
            position: None,
            partial: Vec::new(),
            skipping: false,
            unreadable: false,
            seen_absent: false,
        });
        Ok(())
    }

    /// Whether the file at `path` is followed.
    pub fn is_following(&self, path: &str) -> bool {
        self.files.iter().any(|followed| followed.spec.path == path)
    }

    /// Whether any file is followed.
    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }

    /// The Sigma `service` names of the files followed.
    pub fn services(&self) -> Vec<String> {
        self.files.iter().map(|f| f.service.clone()).collect()
    }

    /// The Sigma `category` names the files followed can give.
    pub fn categories(&self) -> Vec<String> {
        if self
            .files
            .iter()
            .any(|f| f.spec.format == LogFileFormat::Web)
        {
            vec!["webserver".to_string()]
        } else {
            Vec::new()
        }
    }

    /// Read what was written to the files since the last reading.
    pub fn read(&mut self) -> Vec<DecodedLog> {
        let mut logs = Vec::new();
        let mut moved = false;
        for index in 0..self.files.len() {
            let before = self.files[index].position;
            self.read_file(index, &mut logs);
            let followed = &self.files[index];
            if followed.position != before {
                moved = true;
                if let Some(position) = followed.position {
                    self.saved
                        .files
                        .insert(followed.spec.path.clone(), position);
                }
            }
        }
        if moved {
            self.save();
        }
        logs
    }

    fn read_file(&mut self, index: usize, logs: &mut Vec<DecodedLog>) {
        let saved = self.saved.files.get(&self.files[index].spec.path).copied();
        let followed = &mut self.files[index];
        let path = PathBuf::from(&followed.spec.path);
        let metadata = std::fs::metadata(&path);

        // The file under this name is no longer the one being read: finish
        // the old one, which may have received lines before it was renamed.
        if let (Some(position), Ok(metadata)) = (followed.position, &metadata)
            && followed.file.is_some()
            && position.identity.is_some()
            && position.identity != identity(metadata)
        {
            read_lines(followed, u64::MAX, logs);
            followed.file = None;
            followed.partial.clear();
            followed.skipping = false;
            followed.position = Some(Position {
                identity: identity(metadata),
                offset: 0,
            });
        }

        let metadata = match metadata {
            Ok(metadata) if metadata.is_file() => metadata,
            // Not there (yet, or between a rotation and the new file).
            _ => {
                if followed.file.is_some() {
                    read_lines(followed, u64::MAX, logs);
                }
                followed.seen_absent = true;
                return;
            }
        };

        if followed.file.is_none() {
            let file = match File::open(&path) {
                Ok(file) => file,
                Err(e) => {
                    if !followed.unreadable {
                        warn!("Log file {} cannot be read: {}", path.display(), e);
                        followed.unreadable = true;
                    }
                    return;
                }
            };
            followed.unreadable = false;
            let current = identity(&metadata);
            let offset = match followed.position.or(saved) {
                // Read before, and still the same file: go on from there.
                Some(position)
                    if position.identity == current && position.offset <= metadata.len() =>
                {
                    position.offset
                }
                // Read before, another file since: all of it is new.
                Some(_) => 0,
                // Created while it was followed: all of it is new.
                None if followed.seen_absent => 0,
                // Never read: its history is not replayed.
                None => metadata.len(),
            };
            followed.file = Some(file);
            followed.position = Some(Position {
                identity: current,
                offset,
            });
        }

        // Truncated in place (`copytruncate`): start again.
        if let Some(position) = followed.position.as_mut()
            && metadata.len() < position.offset
        {
            debug!("Log file {} was truncated", path.display());
            position.offset = 0;
            followed.partial.clear();
            followed.skipping = false;
        }
        read_lines(followed, MAX_BYTES_PER_READ, logs);
    }

    fn save(&self) {
        let Some(path) = &self.state_path else {
            return;
        };
        let write = || -> std::io::Result<()> {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut tmp = path.as_os_str().to_owned();
            tmp.push(".tmp");
            let tmp = PathBuf::from(tmp);
            std::fs::write(&tmp, serde_json::to_vec(&self.saved)?)?;
            std::fs::rename(&tmp, path)
        };
        if let Err(e) = write() {
            warn!("Failed to save log file positions: {}", e);
        }
    }
}

/// Read up to `limit` bytes from the open file of `followed`, from its
/// position, and decode the complete lines.
fn read_lines(followed: &mut Followed, limit: u64, logs: &mut Vec<DecodedLog>) {
    let (Some(file), Some(position)) = (followed.file.as_mut(), followed.position.as_mut()) else {
        return;
    };
    if file.seek(SeekFrom::Start(position.offset)).is_err() {
        return;
    }
    let mut buffer = Vec::new();
    let read = match file.take(limit).read_to_end(&mut buffer) {
        Ok(read) => read as u64,
        Err(e) => {
            debug!("Log file {} read failed: {}", followed.spec.path, e);
            return;
        }
    };
    position.offset += read;

    for byte in buffer {
        if byte != b'\n' {
            if followed.skipping {
                continue;
            }
            if followed.partial.len() >= MAX_LINE_BYTES {
                // The line is cut here; what follows it is dropped.
                followed.skipping = true;
                continue;
            }
            followed.partial.push(byte);
            continue;
        }
        followed.skipping = false;
        let line = String::from_utf8_lossy(&followed.partial);
        let line = line.trim_end_matches('\r');
        if !line.trim().is_empty() {
            logs.push(decode_line(line, followed.spec.format, &followed.service));
        }
        followed.partial.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn spec(path: &Path, format: LogFileFormat) -> LogFileConfig {
        LogFileConfig {
            path: path.to_string_lossy().to_string(),
            format,
            service: None,
        }
    }

    fn append(path: &Path, text: &str) {
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .unwrap();
        file.write_all(text.as_bytes()).unwrap();
    }

    fn messages(logs: &[DecodedLog]) -> Vec<&str> {
        logs.iter().map(|log| log.get("message").unwrap()).collect()
    }

    fn tailer(path: &Path, state: Option<&Path>) -> LogFileTailer {
        let (tailer, errors) = LogFileTailer::new(
            &[spec(path, LogFileFormat::Text)],
            state.map(Path::to_path_buf),
        );
        assert!(errors.is_empty(), "{errors:?}");
        tailer
    }

    #[test]
    fn only_what_is_written_after_the_first_reading_is_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        append(&path, "old line 1\nold line 2\n");
        let mut tailer = tailer(&path, None);
        assert!(tailer.read().is_empty(), "history is not replayed");

        append(&path, "new line\n");
        assert_eq!(messages(&tailer.read()), ["new line"]);
        assert!(tailer.read().is_empty());
    }

    #[test]
    fn a_line_is_read_once_it_is_complete() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        append(&path, "");
        let mut tailer = tailer(&path, None);
        tailer.read();

        append(&path, "first half");
        assert!(tailer.read().is_empty());
        append(&path, ", second half\r\nnext");
        assert_eq!(messages(&tailer.read()), ["first half, second half"]);
        append(&path, "\n\n");
        assert_eq!(messages(&tailer.read()), ["next"]);
    }

    #[test]
    fn lines_written_while_the_agent_was_stopped_are_read_at_the_next_start() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        let state = dir.path().join("state").join("positions.json");
        append(&path, "before\n");
        let mut first = tailer(&path, Some(&state));
        first.read();
        append(&path, "seen\n");
        assert_eq!(messages(&first.read()), ["seen"]);
        drop(first);

        append(&path, "written while stopped\n");
        let mut second = tailer(&path, Some(&state));
        assert_eq!(messages(&second.read()), ["written while stopped"]);
    }

    #[cfg(unix)]
    #[test]
    fn a_rotated_file_is_finished_then_the_new_one_read_from_its_start() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        append(&path, "old\n");
        let mut tailer = tailer(&path, None);
        tailer.read();

        append(&path, "last line of the old file\n");
        std::fs::rename(&path, dir.path().join("app.log.1")).unwrap();
        append(&path, "first line of the new file\n");
        assert_eq!(
            messages(&tailer.read()),
            ["last line of the old file", "first line of the new file"]
        );
        append(&path, "second\n");
        assert_eq!(messages(&tailer.read()), ["second"]);
    }

    #[cfg(unix)]
    #[test]
    fn a_file_replaced_while_the_agent_was_stopped_is_read_whole() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        let state = dir.path().join("positions.json");
        append(&path, "a long line of the old file\n");
        let mut first = tailer(&path, Some(&state));
        first.read();
        append(&path, "x\n");
        first.read();
        drop(first);

        std::fs::rename(&path, dir.path().join("app.log.1")).unwrap();
        append(&path, "new 1\nnew 2\n");
        let mut second = tailer(&path, Some(&state));
        assert_eq!(messages(&second.read()), ["new 1", "new 2"]);
    }

    #[test]
    fn a_file_truncated_in_place_is_read_from_its_start() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        append(&path, "one\ntwo\nthree\n");
        let mut tailer = tailer(&path, None);
        tailer.read();

        std::fs::write(&path, "after\n").unwrap();
        assert_eq!(messages(&tailer.read()), ["after"]);
    }

    #[test]
    fn a_file_created_while_it_is_followed_is_read_from_its_start() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("later.log");
        let mut tailer = tailer(&path, None);
        assert!(tailer.read().is_empty());

        append(&path, "first\n");
        assert_eq!(messages(&tailer.read()), ["first"]);
        append(&path, "second\n");
        assert_eq!(messages(&tailer.read()), ["second"]);
    }

    #[test]
    fn an_overlong_line_is_cut_and_the_next_one_read_normally() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        append(&path, "");
        let mut tailer = tailer(&path, None);
        tailer.read();

        append(
            &path,
            &format!("{}\nshort\n", "x".repeat(MAX_LINE_BYTES + 500)),
        );
        let logs = tailer.read();
        assert_eq!(logs.len(), 2);
        assert!(logs[0].get("message").unwrap().len() <= MAX_LINE_BYTES);
        assert_eq!(logs[1].get("message"), Some("short"));
    }

    #[test]
    fn lines_are_decoded_in_the_declared_format_under_the_declared_name() {
        let dir = tempfile::tempdir().unwrap();
        let access = dir.path().join("access.log");
        let auth = dir.path().join("auth.log");
        let app = dir.path().join("app.json");
        for path in [&access, &auth, &app] {
            append(path, "");
        }
        let (mut tailer, errors) = LogFileTailer::new(
            &[
                LogFileConfig {
                    service: Some("Nginx".to_string()),
                    ..spec(&access, LogFileFormat::Web)
                },
                spec(&auth, LogFileFormat::Syslog),
                spec(&app, LogFileFormat::Json),
            ],
            None,
        );
        assert!(errors.is_empty());
        assert_eq!(tailer.services(), ["nginx", "auth", "app"]);
        assert_eq!(tailer.categories(), ["webserver"]);
        tailer.read();

        append(
            &access,
            "203.0.113.9 - - [10/Oct/2026:13:55:36 +0000] \"GET /admin HTTP/1.1\" 404 12\nnot an access line\n",
        );
        append(
            &auth,
            "Oct 11 22:14:15 web01 sshd[812]: Failed password for root from 203.0.113.9 port 4444 ssh2\n",
        );
        append(&app, "{\"level\":\"error\",\"msg\":\"denied\"}\n");
        let logs = tailer.read();
        assert_eq!(logs.len(), 4);

        assert_eq!(logs[0].get("sc-status"), Some("404"));
        assert_eq!(logs[0].services, ["nginx"]);
        assert_eq!(logs[0].categories, ["webserver"]);
        // A line the format does not recognise is kept as text.
        assert_eq!(logs[1].get("message"), Some("not an access line"));
        assert!(logs[1].categories.is_empty());

        assert_eq!(logs[2].get("action"), Some("login_failed"));
        assert_eq!(logs[2].services, ["sshd", "auth", "syslog"]);

        assert_eq!(logs[3].get("level"), Some("error"));
        assert_eq!(logs[3].services, ["app"]);
    }

    #[test]
    fn declarations_that_cannot_be_followed_are_refused_with_the_reason() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        let (tailer, errors) = LogFileTailer::new(
            &[
                spec(Path::new("relative/app.log"), LogFileFormat::Text),
                spec(&path, LogFileFormat::Text),
                spec(&path, LogFileFormat::Json),
            ],
            None,
        );
        assert_eq!(tailer.services(), ["app"]);
        assert_eq!(errors.len(), 2, "{errors:?}");
        assert!(errors[0].contains("not an absolute path"));
        assert!(errors[1].contains("declared twice"));
    }

    #[test]
    fn a_large_backlog_is_caught_up_over_several_readings() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        append(&path, "");
        let mut tailer = tailer(&path, None);
        tailer.read();

        let line = format!("{}\n", "y".repeat(1023));
        let lines = (MAX_BYTES_PER_READ as usize / line.len()) + 100;
        append(&path, &line.repeat(lines));
        let first = tailer.read().len();
        assert!(first > 0 && first < lines, "{first} of {lines}");
        let second = tailer.read().len();
        assert_eq!(first + second, lines);
    }
}
