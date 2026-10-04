// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Locating per-user data on the endpoint.

use std::path::{Path, PathBuf};

/// Entries examined per directory, as a guard against pathological trees.
const MAX_ENTRIES_PER_DIR: usize = 20_000;

/// Children of `base` that are directories, optionally filtered by a name
/// prefix, sorted. Missing or unreadable directories yield nothing.
pub(crate) fn child_dirs(base: &Path, prefix: &str) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(base) else {
        return Vec::new();
    };
    let mut dirs: Vec<PathBuf> = entries
        .flatten()
        .take(MAX_ENTRIES_PER_DIR)
        .filter(|entry| entry.file_name().to_string_lossy().starts_with(prefix))
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect();
    dirs.sort();
    dirs
}

/// Home directories to look into: every user's when the agent can list them
/// (it usually runs as root or SYSTEM), and the current user's.
pub(crate) fn user_homes() -> Vec<PathBuf> {
    let mut homes: Vec<PathBuf> = Vec::new();
    let base = if cfg!(windows) {
        std::env::var_os("SystemDrive")
            .map(|drive| PathBuf::from(format!("{}\\Users", drive.to_string_lossy())))
            .unwrap_or_else(|| PathBuf::from(r"C:\Users"))
    } else if cfg!(target_os = "macos") {
        PathBuf::from("/Users")
    } else {
        PathBuf::from("/home")
    };
    for dir in child_dirs(&base, "") {
        let name = dir.file_name().map(|n| n.to_string_lossy().to_string());
        let system_profile = matches!(
            name.as_deref(),
            Some("Shared" | "Guest" | "Public" | "Default" | "Default User" | "All Users")
        );
        if !system_profile && !name.is_some_and(|n| n.starts_with('.')) {
            homes.push(dir);
        }
    }
    let own = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .filter(|home| home.is_absolute());
    if let Some(own) = own
        && !homes.contains(&own)
    {
        homes.push(own);
    }
    homes
}
