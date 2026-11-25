// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The addresses this agent blocked and has not unblocked yet.
//!
//! Firewall rules outlive the process and are written by the privileged
//! service, which the desktop application cannot read back. This ledger is
//! kept by whoever asks for a block (the interface, a playbook, a detection
//! rule), so the interface can list what is blocked and offer to unblock it
//! after a restart as well.

use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tracing::warn;

/// One blocked address.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockedAddress {
    pub ip: String,
    /// When the block was asked for, Unix seconds.
    pub blocked_at: i64,
    /// When the block lifts on its own, Unix seconds; `None`: until unblocked.
    pub unblock_at: Option<i64>,
}

fn ledger_path() -> PathBuf {
    super::quarantine_dir()
        .parent()
        .map(std::path::Path::to_path_buf)
        .unwrap_or_else(std::env::temp_dir)
        .join("blocked_addresses.json")
}

async fn load() -> BTreeMap<String, BlockedAddress> {
    match tokio::fs::read_to_string(ledger_path()).await {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => BTreeMap::new(),
    }
}

async fn store(entries: &BTreeMap<String, BlockedAddress>) {
    let path = ledger_path();
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    match serde_json::to_string_pretty(entries) {
        Ok(json) => {
            if let Err(e) = tokio::fs::write(&path, json).await {
                warn!("Failed to persist the blocked addresses: {}", e);
            }
        }
        Err(e) => warn!("Failed to serialize the blocked addresses: {}", e),
    }
}

/// The entries still in force at `now`.
fn in_force(
    entries: BTreeMap<String, BlockedAddress>,
    now: i64,
) -> BTreeMap<String, BlockedAddress> {
    entries
        .into_iter()
        .filter(|(_, entry)| entry.unblock_at.is_none_or(|at| at > now))
        .collect()
}

/// Record a block that was just applied. `duration_secs` of 0: until unblocked.
pub async fn record(ip: &str, duration_secs: u64) {
    let now = chrono::Utc::now().timestamp();
    let mut entries = in_force(load().await, now);
    entries.insert(
        ip.to_string(),
        BlockedAddress {
            ip: ip.to_string(),
            blocked_at: now,
            unblock_at: (duration_secs > 0).then(|| now.saturating_add(duration_secs as i64)),
        },
    );
    store(&entries).await;
}

/// Forget an address that was unblocked.
pub async fn forget(ip: &str) {
    let mut entries = load().await;
    if entries.remove(ip).is_some() {
        store(&entries).await;
    }
}

/// The addresses blocked right now, most recent first. Blocks whose time is
/// up are left out: the service that applied them lifts them on its own.
pub async fn list() -> Vec<BlockedAddress> {
    let mut entries: Vec<BlockedAddress> = in_force(load().await, chrono::Utc::now().timestamp())
        .into_values()
        .collect();
    entries.sort_by(|a, b| b.blocked_at.cmp(&a.blocked_at).then(a.ip.cmp(&b.ip)));
    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_recorded_block_is_listed_until_it_is_forgotten() {
        record("203.0.113.7", 0).await;
        record("203.0.113.8", 3600).await;
        let listed = list().await;
        assert_eq!(listed.len(), 2);
        let permanent = listed.iter().find(|e| e.ip == "203.0.113.7").unwrap();
        assert_eq!(permanent.unblock_at, None);
        let timed = listed.iter().find(|e| e.ip == "203.0.113.8").unwrap();
        assert_eq!(timed.unblock_at, Some(timed.blocked_at + 3600));

        forget("203.0.113.7").await;
        let listed = list().await;
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].ip, "203.0.113.8");
    }

    #[test]
    fn a_block_whose_time_is_up_is_no_longer_in_force() {
        let entry = |ip: &str, unblock_at| {
            (
                ip.to_string(),
                BlockedAddress {
                    ip: ip.to_string(),
                    blocked_at: 100,
                    unblock_at,
                },
            )
        };
        let entries: BTreeMap<_, _> = [
            entry("198.51.100.1", Some(150)),
            entry("198.51.100.2", Some(250)),
            entry("198.51.100.3", None),
        ]
        .into_iter()
        .collect();
        let kept: Vec<String> = in_force(entries, 200).into_keys().collect();
        assert_eq!(kept, ["198.51.100.2", "198.51.100.3"]);
    }
}
