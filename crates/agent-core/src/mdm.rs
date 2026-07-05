// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! MDM software deployment executor.
//!
//! Executes `install` / `uninstall` / `update` commands dispatched by the
//! Sentinel GRC MDM console. The design is deliberately conservative:
//!
//! - **No arbitrary shell.** Installers are launched with an explicit argument
//!   vector (`argv`), never through a shell, so payload strings cannot be
//!   interpreted as commands.
//! - **HTTPS-only sources.** Install packages must be fetched over TLS.
//! - **Mandatory integrity.** Every downloaded package is verified against a
//!   SHA-256 checksum supplied by the server; a missing or malformed checksum
//!   aborts the deployment (same policy as the agent self-update path).
//! - **Method allowlist.** Only vetted installer formats are accepted; unknown
//!   or free-form (`custom`) methods are rejected.
//! - **Privilege gate.** System-mutating actions require administrator/root.
//!
//! The result of each command is serialized to a compact JSON blob and returned
//! as the command `output`, which the server merges with the stored command
//! payload to update software inventory, deployment and policy state.

use crate::api_client::ApiClient;
use agent_common::error::{CommonError, Result};
use agent_common::process::silent_command;
use serde::Serialize;
use serde_json::Value;
use std::path::Path;
use tracing::{error, info, warn};

/// Maximum length accepted for a software name (defense against absurd input).
const MAX_SOFTWARE_NAME_LEN: usize = 256;

/// Characters forbidden in any value that reaches an installer argument.
/// Even though we never invoke a shell, we reject these defensively so a
/// malicious or malformed server payload cannot smuggle metacharacters into a
/// path, package name, or install argument.
const UNSAFE_ARG_CHARS: [char; 20] = [
    ';', '|', '&', '$', '`', '\n', '\r', '(', ')', '{', '}', '<', '>', '*', '?', '[', ']', '!',
    '\\', '"',
];

/// Installer formats the agent knows how to run safely.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeploymentMethod {
    Msi,
    Exe,
    Pkg,
    Deb,
    Rpm,
}

impl DeploymentMethod {
    fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "msi" => Some(Self::Msi),
            "exe" => Some(Self::Exe),
            "pkg" => Some(Self::Pkg),
            "deb" => Some(Self::Deb),
            "rpm" => Some(Self::Rpm),
            // dmg/appstore/custom are intentionally unsupported: they require
            // interactive mounting or free-form commands we will not execute.
            _ => None,
        }
    }
}

/// Structured outcome of an MDM command, returned to the server as JSON output.
#[derive(Debug, Clone, Serialize)]
pub struct MdmCommandResult {
    /// Command discriminator understood by the server processors.
    #[serde(rename = "commandType")]
    pub command_type: String,
    /// Whether the action succeeded.
    pub success: bool,
    /// Software document id this action applied to (echoed back for the server).
    #[serde(rename = "softwareId", skip_serializing_if = "Option::is_none")]
    pub software_id: Option<String>,
    /// Resolved/target version after a successful install or update.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// New version after an update (server reads `newVersion` for updates).
    #[serde(rename = "newVersion", skip_serializing_if = "Option::is_none")]
    pub new_version: Option<String>,
    /// Deployment id, echoed back so the server can flip deployment status.
    #[serde(rename = "deploymentId", skip_serializing_if = "Option::is_none")]
    pub deployment_id: Option<String>,
    /// Human-readable detail (stdout tail or error message).
    pub message: String,
}

impl MdmCommandResult {
    pub fn failure(
        command_type: &str,
        software_id: Option<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            command_type: command_type.to_string(),
            success: false,
            software_id,
            version: None,
            new_version: None,
            deployment_id: None,
            message: message.into(),
        }
    }

    /// Serialize to the JSON string carried in the command `output` field.
    pub fn to_output(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            format!(
                "{{\"commandType\":\"{}\",\"success\":{},\"message\":\"result serialization failed\"}}",
                self.command_type, self.success
            )
        })
    }
}

/// Parsed and validated install request extracted from the command payload.
struct InstallRequest {
    software_id: Option<String>,
    version: String,
    deployment_id: Option<String>,
    method: DeploymentMethod,
    url: String,
    checksum: String,
    install_args: Vec<String>,
}

/// Validate that a free-text value is safe to pass as an installer argument.
fn validate_arg(label: &str, value: &str) -> Result<()> {
    if value.is_empty() {
        return Err(CommonError::validation(format!("{label} is empty")));
    }
    if value.len() > MAX_SOFTWARE_NAME_LEN {
        return Err(CommonError::validation(format!("{label} is too long")));
    }
    if value.contains(UNSAFE_ARG_CHARS) {
        return Err(CommonError::validation(format!(
            "{label} contains unsafe characters"
        )));
    }
    Ok(())
}

/// Validate a SHA-256 checksum string (64 lowercase/upper hex chars).
fn validate_checksum(checksum: &str) -> Result<String> {
    let c = checksum
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_lowercase();
    if c.len() != 64 || !c.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(CommonError::validation(
            "install package checksum must be a 64-char SHA-256 hex string",
        ));
    }
    Ok(c)
}

/// Extract and validate an [`InstallRequest`] from a command payload.
fn parse_install_request(payload: &Value) -> Result<InstallRequest> {
    let software_id = payload
        .get("softwareId")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let deployment_id = payload
        .get("deploymentId")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let version = payload
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("latest")
        .to_string();

    let cfg = payload
        .get("deploymentConfig")
        .ok_or_else(|| CommonError::validation("missing deploymentConfig"))?;

    let method = cfg
        .get("deploymentMethod")
        .and_then(|v| v.as_str())
        .and_then(DeploymentMethod::parse)
        .ok_or_else(|| {
            CommonError::validation(
                "unsupported or missing deploymentMethod (allowed: msi, exe, pkg, deb, rpm)",
            )
        })?;

    let source = cfg
        .get("source")
        .ok_or_else(|| CommonError::validation("missing deploymentConfig.source"))?;

    let source_type = source.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if source_type != "url" {
        return Err(CommonError::validation(
            "only 'url' install sources are supported",
        ));
    }

    let url = source
        .get("location")
        .and_then(|v| v.as_str())
        .ok_or_else(|| CommonError::validation("missing source.location"))?
        .to_string();
    if !url.starts_with("https://") {
        return Err(CommonError::validation(
            "install source must be an https:// URL",
        ));
    }

    let checksum = source
        .get("checksum")
        .and_then(|v| v.as_str())
        .ok_or_else(|| CommonError::validation("install package requires a SHA-256 checksum"))?;
    let checksum = validate_checksum(checksum)?;

    // Optional install arguments, each validated to be metacharacter-free.
    let mut install_args = Vec::new();
    if let Some(args) = cfg
        .pointer("/parameters/installArgs")
        .and_then(|v| v.as_array())
    {
        for (i, a) in args.iter().enumerate() {
            let s = a
                .as_str()
                .ok_or_else(|| CommonError::validation("installArgs must be strings"))?;
            validate_arg(&format!("installArgs[{i}]"), s)?;
            install_args.push(s.to_string());
        }
    }

    Ok(InstallRequest {
        software_id,
        version,
        deployment_id,
        method,
        url,
        checksum,
        install_args,
    })
}

/// Verify a downloaded file against an expected SHA-256 checksum (constant time).
fn verify_checksum(path: &Path, expected: &str) -> Result<()> {
    use sha2::{Digest, Sha256};
    use std::io::Read;

    let mut file = std::fs::File::open(path)
        .map_err(|e| CommonError::io(format!("failed to open package: {e}")))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| CommonError::io(format!("failed to read package: {e}")))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let actual = format!("{:x}", hasher.finalize());

    let ct_equal = actual.len() == expected.len()
        && actual
            .as_bytes()
            .iter()
            .zip(expected.as_bytes())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0;
    if !ct_equal {
        error!("MDM package checksum mismatch: expected {expected}, got {actual}");
        return Err(CommonError::validation(
            "package checksum verification failed",
        ));
    }
    Ok(())
}

/// Build the installer argument vector for a downloaded package.
///
/// Returned as `(program, args)`, always launched without a shell.
fn build_install_command(
    method: DeploymentMethod,
    package: &str,
    extra_args: &[String],
) -> (String, Vec<String>) {
    let mut args: Vec<String> = Vec::new();
    let program = match method {
        DeploymentMethod::Msi => {
            args.push("/i".into());
            args.push(package.to_string());
            args.push("/qn".into());
            args.push("/norestart".into());
            "msiexec".to_string()
        }
        DeploymentMethod::Exe => {
            // The silent flags for an EXE are installer-specific; the console
            // provides them via installArgs. We only supply the package path.
            package.to_string()
            // program is the package itself; args are extra_args only
        }
        DeploymentMethod::Pkg => {
            args.push("-pkg".into());
            args.push(package.to_string());
            args.push("-target".into());
            args.push("/".into());
            "/usr/sbin/installer".to_string()
        }
        DeploymentMethod::Deb => {
            args.push("install".into());
            args.push("-y".into());
            args.push(package.to_string());
            "apt-get".to_string()
        }
        DeploymentMethod::Rpm => {
            args.push("install".into());
            args.push("-y".into());
            args.push(package.to_string());
            "dnf".to_string()
        }
    };
    args.extend_from_slice(extra_args);
    (program, args)
}

/// Run a validated install/update request. Downloads, verifies, and installs.
async fn run_install(api: &ApiClient, req: InstallRequest, command_type: &str) -> MdmCommandResult {
    if !crate::service::is_admin() {
        return MdmCommandResult::failure(
            command_type,
            req.software_id,
            "administrator/root privileges are required to install software",
        );
    }

    let temp_dir = match tempfile::tempdir() {
        Ok(d) => d,
        Err(e) => {
            return MdmCommandResult::failure(
                command_type,
                req.software_id,
                format!("failed to create temp dir: {e}"),
            );
        }
    };
    let ext = match req.method {
        DeploymentMethod::Msi => "msi",
        DeploymentMethod::Exe => "exe",
        DeploymentMethod::Pkg => "pkg",
        DeploymentMethod::Deb => "deb",
        DeploymentMethod::Rpm => "rpm",
    };
    let package_path = temp_dir.path().join(format!("mdm_package.{ext}"));

    info!("MDM {}: downloading package from {}", command_type, req.url);
    if let Err(e) = api.download_file(&req.url, &package_path).await {
        return MdmCommandResult::failure(
            command_type,
            req.software_id,
            format!("download failed: {e}"),
        );
    }

    if let Err(e) = verify_checksum(&package_path, &req.checksum) {
        return MdmCommandResult::failure(
            command_type,
            req.software_id,
            format!("integrity check failed: {e}"),
        );
    }

    let package_str = match package_path.to_str() {
        Some(s) => s,
        None => {
            return MdmCommandResult::failure(
                command_type,
                req.software_id,
                "invalid package path",
            );
        }
    };

    let (program, args) = build_install_command(req.method, package_str, &req.install_args);
    info!("MDM {}: running installer '{}'", command_type, program);

    let output = silent_command(&program).args(&args).output();
    match output {
        Ok(out) if out.status.success() => {
            let mut result = MdmCommandResult::failure(command_type, req.software_id.clone(), "");
            result.success = true;
            result.message = format!("{} completed successfully", command_type);
            if command_type == "update" {
                result.new_version = Some(req.version.clone());
            }
            result.version = Some(req.version);
            result.deployment_id = req.deployment_id;
            result
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            let code = out.status.code().unwrap_or(-1);
            warn!(
                "MDM {} installer failed (code {}): {}",
                command_type, code, stderr
            );
            MdmCommandResult::failure(
                command_type,
                req.software_id,
                format!("installer exited with code {code}: {}", stderr.trim()),
            )
        }
        Err(e) => MdmCommandResult::failure(
            command_type,
            req.software_id,
            format!("failed to launch installer: {e}"),
        ),
    }
}

/// Execute an `install` command.
pub async fn execute_install(api: &ApiClient, payload: &Value) -> MdmCommandResult {
    match parse_install_request(payload) {
        Ok(req) => run_install(api, req, "install").await,
        Err(e) => MdmCommandResult::failure("install", software_id_of(payload), e.to_string()),
    }
}

/// Execute an `update` command (download + install of a target version).
pub async fn execute_update(api: &ApiClient, payload: &Value) -> MdmCommandResult {
    // The console may express updates either with a full deploymentConfig
    // (same shape as install) or just a targetVersion. Only the former can be
    // executed by the agent; a bare version bump has no package to fetch.
    if payload.get("deploymentConfig").is_none() {
        return MdmCommandResult::failure(
            "update",
            software_id_of(payload),
            "update requires a deploymentConfig with a package source",
        );
    }
    match parse_install_request(payload) {
        Ok(mut req) => {
            if let Some(tv) = payload.get("targetVersion").and_then(|v| v.as_str()) {
                req.version = tv.to_string();
            }
            run_install(api, req, "update").await
        }
        Err(e) => MdmCommandResult::failure("update", software_id_of(payload), e.to_string()),
    }
}

/// Execute an `uninstall` command using the platform package manager.
pub async fn execute_uninstall(payload: &Value) -> MdmCommandResult {
    let software_id = software_id_of(payload);
    let name = match payload.get("softwareName").and_then(|v| v.as_str()) {
        Some(n) => n,
        None => {
            return MdmCommandResult::failure(
                "uninstall",
                software_id,
                "uninstall requires a softwareName",
            );
        }
    };
    if let Err(e) = validate_arg("softwareName", name) {
        return MdmCommandResult::failure("uninstall", software_id, e.to_string());
    }
    if !crate::service::is_admin() {
        return MdmCommandResult::failure(
            "uninstall",
            software_id,
            "administrator/root privileges are required to uninstall software",
        );
    }

    let (program, args) = match build_uninstall_command(name) {
        Some(v) => v,
        None => {
            return MdmCommandResult::failure(
                "uninstall",
                software_id,
                "uninstall is not supported on this platform",
            );
        }
    };

    info!("MDM uninstall: running '{}' for '{}'", program, name);
    match silent_command(&program).args(&args).output() {
        Ok(out) if out.status.success() => {
            let mut r = MdmCommandResult::failure("uninstall", software_id, "");
            r.success = true;
            r.message = format!("uninstalled '{name}'");
            r
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            MdmCommandResult::failure(
                "uninstall",
                software_id,
                format!("uninstall failed: {}", stderr.trim()),
            )
        }
        Err(e) => MdmCommandResult::failure(
            "uninstall",
            software_id,
            format!("failed to launch uninstaller: {e}"),
        ),
    }
}

/// Build the platform-specific uninstall command for a package name.
fn build_uninstall_command(name: &str) -> Option<(String, Vec<String>)> {
    #[cfg(target_os = "windows")]
    {
        Some((
            "winget".to_string(),
            vec![
                "uninstall".into(),
                "--name".into(),
                name.to_string(),
                "--silent".into(),
                "--accept-source-agreements".into(),
                "--disable-interactivity".into(),
            ],
        ))
    }
    #[cfg(target_os = "macos")]
    {
        // Homebrew casks are the managed-install convention on macOS.
        Some((
            "brew".to_string(),
            vec!["uninstall".into(), "--cask".into(), name.to_string()],
        ))
    }
    #[cfg(target_os = "linux")]
    {
        if std::path::Path::new("/etc/debian_version").exists() {
            Some((
                "apt-get".to_string(),
                vec!["remove".into(), "-y".into(), name.to_string()],
            ))
        } else {
            Some((
                "dnf".to_string(),
                vec!["remove".into(), "-y".into(), name.to_string()],
            ))
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = name;
        None
    }
}

fn software_id_of(payload: &Value) -> Option<String> {
    payload
        .get("softwareId")
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn valid_install_payload() -> Value {
        json!({
            "softwareId": "sw-123",
            "version": "1.2.3",
            "deploymentId": "dep-9",
            "deploymentConfig": {
                "deploymentMethod": "msi",
                "source": {
                    "type": "url",
                    "location": "https://cdn.example.com/app.msi",
                    "checksum": "a".repeat(64)
                },
                "parameters": { "silentInstall": true, "installArgs": ["/log", "install.log"] }
            }
        })
    }

    #[test]
    fn parses_valid_install_request() {
        let req = parse_install_request(&valid_install_payload()).unwrap();
        assert_eq!(req.software_id.as_deref(), Some("sw-123"));
        assert_eq!(req.version, "1.2.3");
        assert_eq!(req.deployment_id.as_deref(), Some("dep-9"));
        assert_eq!(req.method, DeploymentMethod::Msi);
        assert_eq!(req.install_args, vec!["/log", "install.log"]);
    }

    #[test]
    fn rejects_non_https_source() {
        let mut p = valid_install_payload();
        p["deploymentConfig"]["source"]["location"] = json!("http://insecure/app.msi");
        assert!(parse_install_request(&p).is_err());
    }

    #[test]
    fn rejects_missing_checksum() {
        let mut p = valid_install_payload();
        p["deploymentConfig"]["source"]
            .as_object_mut()
            .unwrap()
            .remove("checksum");
        assert!(parse_install_request(&p).is_err());
    }

    #[test]
    fn rejects_bad_checksum_length() {
        let mut p = valid_install_payload();
        p["deploymentConfig"]["source"]["checksum"] = json!("deadbeef");
        assert!(parse_install_request(&p).is_err());
    }

    #[test]
    fn rejects_unsupported_method() {
        let mut p = valid_install_payload();
        p["deploymentConfig"]["deploymentMethod"] = json!("custom");
        assert!(parse_install_request(&p).is_err());
    }

    #[test]
    fn rejects_shell_metacharacters_in_args() {
        let mut p = valid_install_payload();
        p["deploymentConfig"]["parameters"]["installArgs"] = json!(["/log; rm -rf /"]);
        assert!(parse_install_request(&p).is_err());
    }

    #[test]
    fn rejects_non_url_source_type() {
        let mut p = valid_install_payload();
        p["deploymentConfig"]["source"]["type"] = json!("local");
        assert!(parse_install_request(&p).is_err());
    }

    #[test]
    fn build_msi_command_is_silent() {
        let (prog, args) = build_install_command(DeploymentMethod::Msi, "/tmp/app.msi", &[]);
        assert_eq!(prog, "msiexec");
        assert!(args.contains(&"/qn".to_string()));
        assert!(args.contains(&"/i".to_string()));
    }

    #[test]
    fn build_deb_command_uses_apt() {
        let (prog, args) = build_install_command(DeploymentMethod::Deb, "/tmp/app.deb", &[]);
        assert_eq!(prog, "apt-get");
        assert_eq!(args, vec!["install", "-y", "/tmp/app.deb"]);
    }

    #[test]
    fn build_exe_command_runs_package_directly() {
        let (prog, args) =
            build_install_command(DeploymentMethod::Exe, "/tmp/app.exe", &["/S".to_string()]);
        assert_eq!(prog, "/tmp/app.exe");
        assert_eq!(args, vec!["/S"]);
    }

    #[test]
    fn checksum_validation_normalizes_and_checks() {
        assert!(validate_checksum(&"A".repeat(64)).is_ok());
        assert!(validate_checksum("xyz").is_err());
        assert!(validate_checksum(&format!("{} filename.msi", "b".repeat(64))).is_ok());
    }

    #[test]
    fn result_serializes_to_expected_json() {
        let mut r = MdmCommandResult::failure("install", Some("sw-1".into()), "");
        r.success = true;
        r.version = Some("2.0".into());
        r.deployment_id = Some("dep-1".into());
        r.message = "ok".into();
        let out = r.to_output();
        assert!(out.contains("\"commandType\":\"install\""));
        assert!(out.contains("\"success\":true"));
        assert!(out.contains("\"softwareId\":\"sw-1\""));
        assert!(out.contains("\"deploymentId\":\"dep-1\""));
    }

    #[test]
    fn update_without_config_fails_fast() {
        // parse should reject an update payload lacking deploymentConfig
        let p = json!({ "softwareId": "sw-1", "targetVersion": "3.0" });
        assert!(parse_install_request(&p).is_err());
    }
}
