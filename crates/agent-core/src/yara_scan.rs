// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! YARA scanning of the files the integrity monitor reports as created or
//! changed. The engine runs in the `sentinel-yara` helper (see
//! [`agent_scanner::security::yara`]); without the helper or without rules,
//! nothing here does anything.

use agent_common::config::AgentConfig;
use agent_scanner::SecurityIncident;
use agent_scanner::security::yara;
use std::path::Path;
use tracing::{debug, info, warn};

use super::AgentRuntime;

/// FIM change type carried to the playbook engine for a file matching a YARA
/// rule, so a playbook can quarantine it with a "file change" condition.
pub const PLAYBOOK_CHANGE_TYPE: &str = "yara_match";

/// Files scanned per pass of the main loop: a burst of changes (an update,
/// an extraction) must not hold the loop.
const MAX_FILES_PER_PASS: usize = 50;

impl AgentRuntime {
    /// Start the YARA helper when it is installed and rules are present.
    pub(crate) fn start_yara(&self) {
        let rules_dir = AgentConfig::platform_data_dir().join("yara.d");
        let Some((scanner, report)) = yara::start_if_available(&rules_dir) else {
            return;
        };
        info!(
            "YARA scanning is on: {} rule(s), {} rule file(s) refused",
            report.rules,
            report.errors.len()
        );
        for error in &report.errors {
            warn!("YARA rule file not loaded: {}", error);
        }
        *self.yara.lock().unwrap_or_else(|e| e.into_inner()) = Some(scanner);
    }

    /// Whether YARA scanning is on.
    pub(crate) fn yara_enabled(&self) -> bool {
        self.yara
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .is_some()
    }

    /// Scan files and return an incident for each one matching a rule.
    /// Blocking: the helper is asked one file at a time.
    pub(crate) fn yara_scan_files(&self, paths: &[String]) -> Vec<(String, SecurityIncident)> {
        let mut guard = self.yara.lock().unwrap_or_else(|e| e.into_inner());
        let Some(scanner) = guard.as_mut() else {
            return Vec::new();
        };
        let mut found = Vec::new();
        for path in paths.iter().take(MAX_FILES_PER_PASS) {
            match scanner.scan(Path::new(path)) {
                Ok(matches) => {
                    if let Some(incident) = yara::incident(Path::new(path), &matches) {
                        found.push((path.clone(), incident));
                    }
                }
                Err(e) if e.contains("stopped") || e.contains("in time") => {
                    warn!("YARA scanning is off: {}", e);
                    *guard = None;
                    break;
                }
                // A file that vanished, a directory, a file too large…
                Err(e) => debug!("YARA scan of {} skipped: {}", path, e),
            }
        }
        found
    }
}
