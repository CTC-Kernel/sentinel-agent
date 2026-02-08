//! Identity migration - export/import agent identity across machines.
//!
//! Handles hardware change detection and identity migration for when agents
//! move between machines.

use crate::error::{PersistenceError, PersistenceResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use tracing::{debug, info, warn};

/// Exported identity package for migration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityExport {
    /// Export format version.
    pub version: u32,
    /// Agent ID.
    pub agent_id: String,
    /// Organization ID.
    pub organization_id: String,
    /// Client certificate (PEM).
    pub client_certificate: String,
    /// Client private key (PEM, encrypted).
    pub client_private_key: String,
    /// Certificate expiration.
    pub certificate_expires_at: DateTime<Utc>,
    /// Server fingerprints.
    pub server_fingerprints: Vec<String>,
    /// When the identity was enrolled.
    pub enrolled_at: DateTime<Utc>,
    /// Source machine identifier.
    pub source_machine_id: Option<String>,
    /// When the export was created.
    pub exported_at: DateTime<Utc>,
    /// SHA-256 hash for integrity verification.
    pub hash: String,
}

/// Hardware change detection result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareChangeResult {
    /// Whether a hardware change was detected.
    pub changed: bool,
    /// Previous machine ID (if known).
    pub previous_machine_id: Option<String>,
    /// Current machine ID.
    pub current_machine_id: Option<String>,
    /// Detail message.
    pub detail: String,
}

/// Manages identity migration between machines.
pub struct MigrationManager;

impl MigrationManager {
    /// Export agent identity to a file for migration.
    #[allow(clippy::too_many_arguments)]
    pub fn export_identity(
        agent_id: &str,
        organization_id: &str,
        client_certificate: &str,
        client_private_key: &str,
        certificate_expires_at: DateTime<Utc>,
        server_fingerprints: &[String],
        enrolled_at: DateTime<Utc>,
        output_path: &Path,
    ) -> PersistenceResult<IdentityExport> {
        info!(
            "Exporting identity for agent {} to {}",
            agent_id,
            output_path.display()
        );

        let source_machine_id = get_machine_id();
        let now = Utc::now();

        // Build identity data (without hash) for hashing — includes all critical fields
        let fingerprints_str = server_fingerprints.join(",");
        let identity_data = format!(
            "{}:{}:{}:{}:{}:{}:{}",
            agent_id,
            organization_id,
            client_certificate,
            client_private_key,
            certificate_expires_at.to_rfc3339(),
            fingerprints_str,
            now.to_rfc3339()
        );

        let mut hasher = Sha256::new();
        hasher.update(identity_data.as_bytes());
        let hash = hex::encode(hasher.finalize());

        let export = IdentityExport {
            version: 1,
            agent_id: agent_id.to_string(),
            organization_id: organization_id.to_string(),
            client_certificate: client_certificate.to_string(),
            client_private_key: client_private_key.to_string(),
            certificate_expires_at,
            server_fingerprints: server_fingerprints.to_vec(),
            enrolled_at,
            source_machine_id,
            exported_at: now,
            hash,
        };

        let json = serde_json::to_string_pretty(&export)?;
        fs::write(output_path, &json).map_err(|e| {
            PersistenceError::Migration(format!("Failed to write identity export: {}", e))
        })?;

        // Set restrictive permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = fs::Permissions::from_mode(0o600);
            let _ = fs::set_permissions(output_path, permissions);
        }

        info!("Identity exported successfully");
        Ok(export)
    }

    /// Import agent identity from a file.
    pub fn import_identity(input_path: &Path) -> PersistenceResult<IdentityExport> {
        info!("Importing identity from {}", input_path.display());

        if !input_path.exists() {
            return Err(PersistenceError::NotFound(format!(
                "Identity file not found: {}",
                input_path.display()
            )));
        }

        let json = fs::read_to_string(input_path).map_err(|e| {
            PersistenceError::Migration(format!("Failed to read identity file: {}", e))
        })?;

        let export: IdentityExport = serde_json::from_str(&json)?;

        // Verify version
        if export.version != 1 {
            return Err(PersistenceError::Migration(format!(
                "Unsupported identity export version: {}",
                export.version
            )));
        }

        // Verify hash integrity — must match all fields used during export
        let fingerprints_str = export.server_fingerprints.join(",");
        let identity_data = format!(
            "{}:{}:{}:{}:{}:{}:{}",
            export.agent_id,
            export.organization_id,
            export.client_certificate,
            export.client_private_key,
            export.certificate_expires_at.to_rfc3339(),
            fingerprints_str,
            export.exported_at.to_rfc3339()
        );

        let mut hasher = Sha256::new();
        hasher.update(identity_data.as_bytes());
        let computed_hash = hex::encode(hasher.finalize());

        if computed_hash != export.hash {
            return Err(PersistenceError::Integrity(
                "Identity file integrity check failed: hash mismatch".to_string(),
            ));
        }

        info!(
            "Identity imported successfully for agent {}",
            export.agent_id
        );
        Ok(export)
    }

    /// Detect hardware changes by comparing current machine ID with stored one.
    pub fn detect_hardware_change(stored_machine_id: Option<&str>) -> HardwareChangeResult {
        let current_id = get_machine_id();

        match (stored_machine_id, current_id.as_deref()) {
            (Some(stored), Some(current)) if stored == current => HardwareChangeResult {
                changed: false,
                previous_machine_id: Some(stored.to_string()),
                current_machine_id: current_id.clone(),
                detail: "Machine ID matches stored value".to_string(),
            },
            (Some(stored), Some(current)) => {
                warn!(
                    "Hardware change detected: stored={}, current={}",
                    stored, current
                );
                HardwareChangeResult {
                    changed: true,
                    previous_machine_id: Some(stored.to_string()),
                    current_machine_id: current_id.clone(),
                    detail: format!("Machine ID changed from {} to {}", stored, current),
                }
            }
            (Some(stored), None) => {
                warn!(
                    "Cannot determine current machine ID, stored was: {}",
                    stored
                );
                HardwareChangeResult {
                    changed: false,
                    previous_machine_id: Some(stored.to_string()),
                    current_machine_id: None,
                    detail: "Cannot determine current machine ID".to_string(),
                }
            }
            (None, _) => {
                debug!("No stored machine ID for comparison");
                HardwareChangeResult {
                    changed: false,
                    previous_machine_id: None,
                    current_machine_id: current_id.clone(),
                    detail: "No previous machine ID stored".to_string(),
                }
            }
        }
    }
}

/// Get the current machine identifier.
#[cfg(target_os = "linux")]
fn get_machine_id() -> Option<String> {
    fs::read_to_string("/etc/machine-id")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

#[cfg(target_os = "macos")]
fn get_machine_id() -> Option<String> {
    use std::process::Command;

    Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()
        .and_then(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("IOPlatformUUID")
                    && let Some(start) = line.find('"')
                {
                    let rest = line.get(start + 1..).unwrap_or("");
                    if let Some(end) = rest.rfind('"') {
                        let inner = rest.get(..end).unwrap_or("");
                        if let Some(uuid_start) = inner.rfind('"') {
                            return inner.get(uuid_start + 1..).map(|s| s.to_string());
                        }
                    }
                }
            }
            None
        })
}

#[cfg(target_os = "windows")]
fn get_machine_id() -> Option<String> {
    use std::process::Command;

    Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Cryptography",
            "/v",
            "MachineGuid",
        ])
        .output()
        .ok()
        .and_then(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("MachineGuid") {
                    return line.split_whitespace().last().map(|s| s.to_string());
                }
            }
            None
        })
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn get_machine_id() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_export_and_import_identity() {
        let temp_dir = TempDir::new().unwrap();
        let export_path = temp_dir.path().join("identity.json");

        let now = Utc::now();
        let export = MigrationManager::export_identity(
            "agent-123",
            "org-456",
            "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
            now + chrono::Duration::days(365),
            &["sha256:abc".to_string()],
            now,
            &export_path,
        )
        .unwrap();

        assert_eq!(export.agent_id, "agent-123");
        assert_eq!(export.version, 1);

        // Import it back
        let imported = MigrationManager::import_identity(&export_path).unwrap();
        assert_eq!(imported.agent_id, "agent-123");
        assert_eq!(imported.organization_id, "org-456");
        assert_eq!(imported.hash, export.hash);
    }

    #[test]
    fn test_import_corrupted_identity() {
        let temp_dir = TempDir::new().unwrap();
        let export_path = temp_dir.path().join("identity.json");

        // Create identity
        let now = Utc::now();
        MigrationManager::export_identity(
            "agent-123",
            "org-456",
            "cert",
            "key",
            now + chrono::Duration::days(365),
            &[],
            now,
            &export_path,
        )
        .unwrap();

        // Corrupt the file by modifying the agent_id
        let mut content = fs::read_to_string(&export_path).unwrap();
        content = content.replace("agent-123", "agent-TAMPERED");
        fs::write(&export_path, content).unwrap();

        let result = MigrationManager::import_identity(&export_path);
        assert!(matches!(result, Err(PersistenceError::Integrity(_))));
    }

    #[test]
    fn test_import_nonexistent_file() {
        let result = MigrationManager::import_identity(Path::new("/nonexistent/identity.json"));
        assert!(matches!(result, Err(PersistenceError::NotFound(_))));
    }

    #[test]
    fn test_detect_hardware_change_no_change() {
        let result = MigrationManager::detect_hardware_change(None);
        assert!(!result.changed);
    }

    #[test]
    fn test_detect_hardware_change_detected() {
        let result = MigrationManager::detect_hardware_change(Some("old-machine-id"));
        // On test machines, the current ID will be different from "old-machine-id"
        // unless the machine happens to have that exact ID
        if let Some(ref current) = result.current_machine_id
            && current != "old-machine-id"
        {
            assert!(result.changed);
        }
    }
}
