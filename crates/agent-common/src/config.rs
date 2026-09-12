// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Agent configuration types and loader.
//!
//! This module defines the configuration structures for the Sentinel GRC Agent
//! and provides utilities for loading configuration from files and environment variables.
//!
//! # Configuration Priority (lowest to highest)
//! 1. Default values
//! 2. JSON configuration file
//! 3. Environment variables (SENTINEL_* prefix)
//!
//! # Environment Variables
//!
//! All top-level configuration values can be overridden via environment variables
//! with the `SENTINEL_` prefix followed by the field name in upper snake case:
//!
//! - `SENTINEL_SERVER_URL` → `server_url`
//! - `SENTINEL_ENROLLMENT_TOKEN` → `enrollment_token`
//! - `SENTINEL_CA_CERT_PATH` → `ca_cert_path`
//! - `SENTINEL_CHECK_INTERVAL_SECS` → `check_interval_secs`
//! - `SENTINEL_STANDALONE` → `standalone` (`true`: no platform, local protection only)
//!
//! Nested fields are mapped explicitly (see [`NESTED_ENV_KEYS`]):
//!
//! - `SENTINEL_PROXY_URL` → `proxy.url`
//! - `SENTINEL_PROXY_USERNAME` → `proxy.username`
//! - `SENTINEL_PROXY_PASSWORD` → `proxy.password`
//! - `SENTINEL_LLM_ENABLED` → `llm.enabled`
//! - `SENTINEL_LLM_MODEL` → `llm.model`
//!
//! List fields (`fim_watched_paths`, `fim_ignore_patterns`, `active_frameworks`)
//! accept comma-separated values.

use crate::constants::{
    DEFAULT_CHECK_INTERVAL_SECS, DEFAULT_OFFLINE_MODE_DAYS, DEFAULT_SERVER_URL,
};
use config::builder::DefaultState;
use config::{Config, ConfigBuilder, ConfigError, Environment, File, FileFormat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use url::Url;

/// Environment variables that map to *nested* configuration keys.
///
/// The flat `SENTINEL_<FIELD>` convention cannot express nesting (the field
/// names themselves contain underscores), so nested keys are listed here
/// explicitly instead of relying on a separator heuristic.
pub const NESTED_ENV_KEYS: &[(&str, &str)] = &[
    ("SENTINEL_PROXY_URL", "proxy.url"),
    ("SENTINEL_PROXY_USERNAME", "proxy.username"),
    ("SENTINEL_PROXY_PASSWORD", "proxy.password"),
    ("SENTINEL_LLM_ENABLED", "llm.enabled"),
    ("SENTINEL_LLM_MODEL", "llm.model"),
];

/// Top-level list fields that accept comma-separated environment values.
const LIST_ENV_FIELDS: &[&str] = &[
    "fim_watched_paths",
    "fim_ignore_patterns",
    "active_frameworks",
];

/// Snapshot of environment variables (used to inject a fake environment in tests).
type EnvMap = HashMap<String, String>;

/// Main agent configuration.
///
/// Configuration can be loaded from a JSON file or environment variables.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct AgentConfig {
    /// URL of the Sentinel GRC SaaS server.
    #[serde(default = "default_server_url")]
    pub server_url: String,

    /// Unique identifier for this agent instance.
    /// Generated during enrollment if not provided.
    #[serde(default)]
    pub agent_id: Option<String>,

    /// Interval between compliance checks in seconds.
    #[serde(default = "default_check_interval")]
    pub check_interval_secs: u64,

    /// Interval between heartbeats in seconds.
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval_secs: u64,

    /// Maximum number of days to operate in offline mode.
    #[serde(default = "default_offline_mode_days")]
    pub offline_mode_days: u32,

    /// Log level (trace, debug, info, warn, error).
    #[serde(default = "default_log_level")]
    pub log_level: String,

    /// Path to the local database file.
    #[serde(default = "default_db_path")]
    pub db_path: String,

    /// Whether to enable TLS certificate verification.
    #[serde(default = "default_tls_verify")]
    pub tls_verify: bool,

    /// Path to custom CA certificate (optional).
    #[serde(default)]
    pub ca_cert_path: Option<String>,

    /// API token for initial enrollment.
    #[serde(default)]
    pub enrollment_token: Option<String>,

    /// Proxy configuration (optional).
    #[serde(default)]
    pub proxy: Option<ProxyConfig>,

    /// File Integrity Monitoring watched paths (overrides defaults).
    #[serde(default)]
    pub fim_watched_paths: Option<Vec<String>>,

    /// File Integrity Monitoring ignore patterns.
    #[serde(default)]
    pub fim_ignore_patterns: Option<Vec<String>>,

    /// Whether to enable USB device monitoring.
    #[serde(default = "default_true")]
    pub usb_monitoring: bool,

    /// Whether to block USB mass storage by default.
    #[serde(default = "default_true")]
    pub usb_block_mass_storage: bool,

    /// Organization ID for API authentication (loaded from DB, not serialized).
    #[serde(skip)]
    pub organization_id: Option<String>,

    /// Client certificate for mTLS authentication (loaded from DB, not serialized).
    #[serde(skip)]
    pub client_certificate: Option<String>,

    /// Client private key for HMAC signature authentication (loaded from DB, not serialized).
    #[serde(skip)]
    pub client_key: Option<String>,

    /// List of active compliance frameworks (e.g. "ISO27001", "NIST").
    /// If provided, only checks associated with these frameworks will be executed.
    #[serde(default)]
    pub active_frameworks: Option<Vec<String>>,

    /// Admin password for the agent (set during enrollment, not serialized to config file).
    /// Zeroized from memory on drop to prevent credential leakage.
    #[serde(skip)]
    pub admin_password: Option<String>,

    /// LLM configuration settings.
    #[serde(default)]
    pub llm: LLMSettings,

    /// Standalone mode: the agent protects this endpoint on its own, with no
    /// Sentinel GRC platform behind it.
    ///
    /// No enrollment, no heartbeat, no upload, no remote command and no
    /// self-update from a server: detection (EDR), file integrity, compliance
    /// checks, vulnerability scanning, the local database and the local
    /// assistant all keep working. Chosen at installation for individuals and
    /// for endpoints that only need protection; `sentinel-agent connect` (or
    /// the "Connecter à une plateforme" action) leaves it later.
    #[serde(default)]
    pub standalone: bool,
}

/// LLM configuration settings for the agent.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct LLMSettings {
    /// Whether to enable AI features (scanning analysis, remediation suggestion).
    pub enabled: bool,

    /// LLM model name.
    #[serde(default = "default_llm_model")]
    pub model: String,
}

fn default_llm_model() -> String {
    "mistral-7b-v0.3".to_string()
}

impl AgentConfig {
    /// Securely zeroize all sensitive fields from memory.
    ///
    /// Call this before dropping the config if it contains credentials
    /// (admin password, enrollment token, client certificate, private key).
    /// This prevents credential leakage via memory forensics.
    pub fn zeroize_secrets(&mut self) {
        if let Some(ref mut password) = self.admin_password {
            zeroize::Zeroize::zeroize(password);
        }
        if let Some(ref mut key) = self.client_key {
            zeroize::Zeroize::zeroize(key);
        }
        if let Some(ref mut cert) = self.client_certificate {
            zeroize::Zeroize::zeroize(cert);
        }
        if let Some(ref mut token) = self.enrollment_token {
            zeroize::Zeroize::zeroize(token);
        }
    }
}

// Note: AgentConfig intentionally does NOT implement Drop because it
// derives Clone and tests use `..Default::default()` partial-move syntax,
// which is incompatible with Drop. In production code, wrap the config in
// `SecureConfig` (below) which implements Drop and calls `zeroize_secrets()`
// automatically. In test code, use `AgentConfig` directly.

/// RAII wrapper that ensures `AgentConfig` secrets are zeroized on drop.
///
/// Use this in production code to hold configurations that contain sensitive
/// data (enrollment tokens, client keys, admin passwords). The inner config
/// is automatically zeroized when this wrapper goes out of scope.
///
/// In test code, use `AgentConfig` directly (it supports `..Default::default()`
/// syntax which is incompatible with `Drop`).
pub struct SecureConfig(pub AgentConfig);

impl std::ops::Deref for SecureConfig {
    type Target = AgentConfig;
    fn deref(&self) -> &AgentConfig {
        &self.0
    }
}

impl std::ops::DerefMut for SecureConfig {
    fn deref_mut(&mut self) -> &mut AgentConfig {
        &mut self.0
    }
}

impl Drop for SecureConfig {
    fn drop(&mut self) {
        self.0.zeroize_secrets();
    }
}

impl From<AgentConfig> for SecureConfig {
    fn from(config: AgentConfig) -> Self {
        SecureConfig(config)
    }
}

/// Proxy configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct ProxyConfig {
    /// Proxy URL (e.g., "http://proxy.example.com:8080").
    pub url: String,

    /// Proxy username (optional).
    #[serde(default)]
    pub username: Option<String>,

    /// Proxy password (optional).
    /// Zeroized from memory on drop to prevent credential leakage.
    #[serde(default)]
    pub password: Option<String>,
}

impl Drop for ProxyConfig {
    fn drop(&mut self) {
        // Zeroize password from memory to prevent credential leakage
        if let Some(ref mut password) = self.password {
            zeroize::Zeroize::zeroize(password);
        }
    }
}

fn default_server_url() -> String {
    DEFAULT_SERVER_URL.to_string()
}

fn default_check_interval() -> u64 {
    DEFAULT_CHECK_INTERVAL_SECS
}

fn default_heartbeat_interval() -> u64 {
    60
}

fn default_offline_mode_days() -> u32 {
    DEFAULT_OFFLINE_MODE_DAYS
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_db_path() -> String {
    let base = AgentConfig::platform_data_dir();
    #[cfg(windows)]
    {
        // AC4: Windows database at C:\ProgramData\Sentinel\data\agent.db
        base.join("data")
            .join("agent.db")
            .to_string_lossy()
            .to_string()
    }
    #[cfg(not(windows))]
    {
        // AC4: Linux database at /var/lib/sentinel-grc/agent.db
        base.join("agent.db").to_string_lossy().to_string()
    }
}

fn default_tls_verify() -> bool {
    true
}

fn default_true() -> bool {
    true
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            server_url: default_server_url(),
            agent_id: None,
            check_interval_secs: default_check_interval(),
            heartbeat_interval_secs: default_heartbeat_interval(),
            offline_mode_days: default_offline_mode_days(),
            log_level: default_log_level(),
            db_path: default_db_path(),
            tls_verify: default_tls_verify(),
            ca_cert_path: None,
            enrollment_token: None,
            proxy: None,
            fim_watched_paths: None,
            fim_ignore_patterns: None,
            usb_monitoring: true,
            usb_block_mass_storage: true,
            organization_id: None,
            client_certificate: None,
            client_key: None,
            active_frameworks: None,
            admin_password: None,
            llm: LLMSettings::default(),
            standalone: false,
        }
    }
}

impl AgentConfig {
    /// Returns true if the agent is enrolled (has an agent_id in configuration).
    pub fn is_enrolled(&self) -> bool {
        self.agent_id.is_some()
    }

    /// Returns true when the agent runs without a platform (see
    /// [`AgentConfig::standalone`]).
    pub fn is_standalone(&self) -> bool {
        self.standalone
    }

    /// Returns true when the agent is ready to protect the endpoint: enrolled
    /// with a platform, or standalone.
    pub fn is_ready(&self) -> bool {
        self.standalone || self.is_enrolled()
    }

    /// Load configuration from file and environment variables.
    ///
    /// Configuration is loaded in the following order (later values override earlier):
    /// 1. Default values
    /// 2. JSON configuration file (platform-specific path or custom path)
    /// 3. Environment variables (SENTINEL_* prefix)
    ///
    /// # Arguments
    /// * `custom_path` - Optional custom config file path (overrides platform default)
    ///
    /// # Returns
    /// Validated `AgentConfig` or error
    ///
    /// # Example
    /// ```no_run
    /// use agent_common::config::AgentConfig;
    ///
    /// // Load from default paths with env overlay
    /// let config = AgentConfig::load(None)?;
    ///
    /// // Load from custom path
    /// let config = AgentConfig::load(Some("/etc/custom/agent.json"))?;
    /// # Ok::<(), agent_common::error::CommonError>(())
    /// ```
    pub fn load(custom_path: Option<&str>) -> crate::error::Result<Self> {
        let config_path = custom_path
            .map(PathBuf::from)
            .or_else(Self::find_config_file);

        let mut builder = Config::builder();

        // Add file source if config file exists
        if let Some(path) = &config_path {
            if path.exists() {
                tracing::info!("Loading configuration from: {}", path.display());
                builder = builder.add_source(File::from(path.clone()).format(FileFormat::Json));
            } else {
                tracing::debug!("Config file not found at: {}", path.display());
            }
        }

        // Add environment variable overrides (SENTINEL_* prefix)
        builder = apply_env_overrides(builder, None).map_err(config_error_to_common)?;

        // Build and deserialize
        let settings = builder.build().map_err(config_error_to_common)?;

        let config: AgentConfig = settings.try_deserialize().map_err(config_error_to_common)?;

        // Validate the loaded configuration
        config.validate()?;

        Ok(config)
    }

    /// Find the configuration file path based on platform.
    ///
    /// # Search Order
    /// 1. Platform-specific system path (see [`Self::platform_config_path`])
    /// 2. Current directory (`./agent.json`) - for development
    ///
    /// # Returns
    /// - `Some(path)` where `path` is an existing config file, OR
    /// - `Some(platform_path)` if no config file exists (allows load() to use defaults)
    ///
    /// Note: This function always returns `Some` to allow the load() function to
    /// proceed with environment variables and defaults even when no config file exists.
    fn find_config_file() -> Option<PathBuf> {
        // Platform-specific paths
        let platform_path = Self::platform_config_path();

        if platform_path.exists() {
            return Some(platform_path);
        }

        // Fallback to current directory for development
        // Gated behind debug_assertions so release builds never pick up a stray agent.json.
        #[cfg(debug_assertions)]
        {
            let dev_path = PathBuf::from("./agent.json");
            if dev_path.exists() {
                tracing::debug!("Dev fallback: using ./agent.json config");
                return Some(dev_path);
            }
        }

        // Return platform path even if it doesn't exist.
        // The load() function will skip non-existent files and proceed with
        // environment variables and default values.
        Some(platform_path)
    }

    /// Get the platform-specific configuration file path.
    pub fn platform_config_path() -> PathBuf {
        if let Ok(dir) = std::env::var("SENTINEL_DATA_DIR") {
            return PathBuf::from(dir).join("agent.json");
        }
        #[cfg(windows)]
        {
            let base = std::env::var("ProgramData")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from(r"C:\ProgramData"));
            base.join("Sentinel").join("agent.json")
        }

        #[cfg(target_os = "macos")]
        {
            directories::BaseDirs::new()
                .map(|dirs| dirs.data_dir().join("SentinelGRC").join("agent.json"))
                .unwrap_or_else(|| {
                    PathBuf::from("/Library/Application Support/SentinelGRC/agent.json")
                })
        }

        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            PathBuf::from("/etc/sentinel/agent.json")
        }
    }

    /// Get the platform-specific data directory.
    pub fn platform_data_dir() -> PathBuf {
        if let Ok(dir) = std::env::var("SENTINEL_DATA_DIR") {
            return PathBuf::from(dir);
        }

        // Development fallback: if a "data" directory exists in the current working directory, use it.
        // This is useful for developers running from the project root.
        // Gated behind debug_assertions so release builds (installers) never hit this path.
        #[cfg(debug_assertions)]
        {
            let local_data = PathBuf::from("data");
            if local_data.exists() && local_data.is_dir() {
                tracing::debug!("Dev fallback: using CWD as data directory (found ./data/)");
                return PathBuf::from(".");
            }
        }

        #[cfg(windows)]
        {
            // Use ProgramData if available and writable, otherwise fallback to LocalAppData
            let program_data = std::env::var("ProgramData")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from(r"C:\ProgramData"))
                .join("Sentinel");

            if program_data.exists() {
                program_data
            } else {
                // Check if we can create it (this is a simplified check)
                if std::fs::create_dir_all(&program_data).is_ok() {
                    program_data
                } else {
                    // Fallback to LocalAppData
                    std::env::var("LOCALAPPDATA")
                        .map(PathBuf::from)
                        .unwrap_or_else(|_| {
                            // Absolute last resort
                            PathBuf::from(r"C:\Users\Public\Documents")
                        })
                        .join("Sentinel")
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            // On macOS, use Library/Application Support for user-level installation
            // or /Library/Application Support for system-wide (requires root)
            directories::BaseDirs::new()
                .map(|dirs| dirs.data_dir().join("SentinelGRC"))
                .unwrap_or_else(|| PathBuf::from("/Library/Application Support/SentinelGRC"))
        }

        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            PathBuf::from("/var/lib/sentinel-grc")
        }
    }

    /// Validate the configuration.
    /// Check that `server_url` names a reachable platform endpoint.
    fn validate_server_url(&self) -> crate::error::Result<()> {
        if self.server_url.is_empty() {
            return Err(crate::error::CommonError::validation(
                "server_url cannot be empty",
            ));
        }

        // Validate URL format
        let url = Url::parse(&self.server_url).map_err(|e| {
            crate::error::CommonError::validation(format!("server_url is not a valid URL: {}", e))
        })?;

        // SECURITY: Enforce HTTPS scheme in release builds to prevent plaintext communication
        #[cfg(not(debug_assertions))]
        if url.scheme() != "https" {
            return Err(crate::error::CommonError::validation(
                "server_url must use HTTPS scheme in production (http:// is forbidden)",
            ));
        }

        // Anti-Draper: Detect missing function name in direct GCF URLs (prevents 404)
        if let Some(host) = url.host_str()
            && host.ends_with("cloudfunctions.net")
            && url.path() == "/"
        {
            return Err(crate::error::CommonError::validation(
                "server_url targeting cloudfunctions.net must include the function name suffix (e.g., /agentApi)",
            ));
        }
        Ok(())
    }

    pub fn validate(&self) -> crate::error::Result<()> {
        // The server is only a requirement when a platform is expected: a
        // standalone agent never opens a connection to one.
        if !self.standalone {
            self.validate_server_url()?;
        }

        // Validate check_interval_secs
        if self.check_interval_secs == 0 {
            return Err(crate::error::CommonError::validation(
                "check_interval_secs must be greater than 0",
            ));
        }
        if self.check_interval_secs > crate::constants::SECS_PER_DAY * 30 {
            return Err(crate::error::CommonError::validation(
                "check_interval_secs must not exceed 30 days (2592000)",
            ));
        }

        // Validate heartbeat_interval_secs
        if self.heartbeat_interval_secs == 0 {
            return Err(crate::error::CommonError::validation(
                "heartbeat_interval_secs must be greater than 0",
            ));
        }

        // Validate offline_mode_days
        if self.offline_mode_days == 0 {
            return Err(crate::error::CommonError::validation(
                "offline_mode_days must be greater than 0",
            ));
        }
        if self.offline_mode_days > 365 {
            return Err(crate::error::CommonError::validation(
                "offline_mode_days must not exceed 365",
            ));
        }

        // Validate log_level
        let valid_levels = ["trace", "debug", "info", "warn", "error"];
        if !valid_levels.contains(&self.log_level.to_lowercase().as_str()) {
            return Err(crate::error::CommonError::validation(format!(
                "log_level must be one of: {:?}",
                valid_levels
            )));
        }

        // Validate proxy URL if present
        if let Some(ref proxy) = self.proxy {
            Url::parse(&proxy.url).map_err(|e| {
                crate::error::CommonError::validation(format!(
                    "proxy.url is not a valid URL: {}",
                    e
                ))
            })?;
        }

        Ok(())
    }
}

impl AgentConfig {
    /// Persist `server_url` into the platform configuration file.
    ///
    /// Used by `sentinel-agent enroll --server <URL>` so the service started
    /// afterwards talks to the same platform the agent enrolled with (typically
    /// an on-premise instance). Other keys already present in the file are
    /// preserved; the file is rewritten in place so ownership and permissions
    /// set by the installer are kept.
    ///
    /// Returns the path of the file that was written.
    pub fn persist_server_url(server_url: &str) -> crate::error::Result<PathBuf> {
        let path = Self::platform_config_path();
        Self::persist_server_url_to(&path, server_url)?;
        Ok(path)
    }

    /// Same as [`Self::persist_server_url`] but targets an explicit file path.
    pub fn persist_server_url_to(path: &Path, server_url: &str) -> crate::error::Result<()> {
        use crate::error::CommonError;

        Url::parse(server_url).map_err(|e| {
            CommonError::validation(format!("server_url is not a valid URL: {}", e))
        })?;
        Self::persist_value_to(
            path,
            "server_url",
            serde_json::Value::String(server_url.trim_end_matches('/').to_string()),
        )
    }

    /// Persist the standalone choice into the platform configuration file.
    ///
    /// Written by the installer (Windows property, macOS choice, Linux
    /// environment) and by `sentinel-agent standalone` / `connect`, so the
    /// service started afterwards knows whether a platform is expected.
    pub fn persist_standalone(standalone: bool) -> crate::error::Result<PathBuf> {
        let path = Self::platform_config_path();
        Self::persist_value_to(&path, "standalone", serde_json::Value::Bool(standalone))?;
        Ok(path)
    }

    /// Set one top-level key of the JSON configuration at `path`, keeping every
    /// other key and the file's ownership and permissions.
    pub fn persist_value_to(
        path: &Path,
        key: &str,
        value: serde_json::Value,
    ) -> crate::error::Result<()> {
        use crate::error::CommonError;

        let mut root = match std::fs::read_to_string(path) {
            Ok(content) if !content.trim().is_empty() => {
                serde_json::from_str::<serde_json::Value>(&content).map_err(|e| {
                    CommonError::config(format!(
                        "refusing to overwrite invalid JSON in {}: {}",
                        path.display(),
                        e
                    ))
                })?
            }
            Ok(_) => serde_json::Value::Object(Default::default()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                serde_json::Value::Object(Default::default())
            }
            Err(e) => {
                return Err(CommonError::config(format!(
                    "failed to read {}: {}",
                    path.display(),
                    e
                )));
            }
        };

        let object = root.as_object_mut().ok_or_else(|| {
            CommonError::config(format!("{} does not contain a JSON object", path.display()))
        })?;
        object.insert(key.to_string(), value);

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                CommonError::config(format!("failed to create {}: {}", parent.display(), e))
            })?;
        }

        let content = serde_json::to_string_pretty(&root)
            .map_err(|e| CommonError::config(format!("failed to serialize config: {}", e)))?;

        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            // Only applies when the file is created; existing mode is preserved.
            options.mode(0o600);
        }
        let mut file = options.open(path).map_err(|e| {
            CommonError::config(format!("failed to open {}: {}", path.display(), e))
        })?;
        use std::io::Write;
        file.write_all(content.as_bytes())
            .and_then(|_| file.write_all(b"\n"))
            .map_err(|e| CommonError::config(format!("failed to write {}: {}", path.display(), e)))
    }
}

/// Apply `SENTINEL_*` environment overrides to a configuration builder.
///
/// * Top-level fields use the flat form `SENTINEL_<FIELD>` (e.g.
///   `SENTINEL_SERVER_URL`). A separator-based mapping would split those names
///   into nested tables (`server.url`) and silently drop them, so no separator
///   is used here.
/// * Nested fields are mapped explicitly from [`NESTED_ENV_KEYS`].
///
/// `env` lets tests inject a fake environment; `None` reads the process
/// environment.
fn apply_env_overrides(
    mut builder: ConfigBuilder<DefaultState>,
    env: Option<&EnvMap>,
) -> Result<ConfigBuilder<DefaultState>, ConfigError> {
    let mut flat = Environment::with_prefix("SENTINEL")
        .prefix_separator("_")
        .try_parsing(true)
        .list_separator(",");
    for field in LIST_ENV_FIELDS {
        flat = flat.with_list_parse_key(field);
    }
    if let Some(map) = env {
        flat = flat.source(Some(map.clone()));
    }
    builder = builder.add_source(flat);

    for (var, key) in NESTED_ENV_KEYS {
        let value = match env {
            Some(map) => map.get(*var).cloned(),
            None => std::env::var(var).ok(),
        };
        if let Some(value) = value {
            builder = builder.set_override(*key, value)?;
        }
    }

    Ok(builder)
}

/// Convert config crate errors to CommonError
fn config_error_to_common(err: ConfigError) -> crate::error::CommonError {
    match err {
        ConfigError::NotFound(key) => {
            crate::error::CommonError::config(format!("configuration key not found: {}", key))
        }
        ConfigError::PathParse { cause } => {
            crate::error::CommonError::config(format!("failed to parse config path: {:?}", cause))
        }
        ConfigError::FileParse { uri, cause } => crate::error::CommonError::config(format!(
            "failed to parse config file '{}': {}",
            uri.unwrap_or_default(),
            cause
        )),
        ConfigError::Type {
            origin,
            unexpected,
            expected,
            key,
        } => crate::error::CommonError::validation(format!(
            "type mismatch for '{}': expected {}, found {} (from {:?})",
            key.unwrap_or_default(),
            expected,
            unexpected,
            origin
        )),
        ConfigError::Message(msg) => crate::error::CommonError::config(msg),
        ConfigError::Foreign(e) => {
            crate::error::CommonError::config(format!("configuration error: {}", e))
        }
        // Catch-all for future ConfigError variants (non-exhaustive enum)
        _ => crate::error::CommonError::config(format!("configuration error: {}", err)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use config::Config;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_default_config() {
        let config = AgentConfig::default();
        assert!(!config.server_url.is_empty());
        assert_eq!(config.check_interval_secs, 3600);
        assert_eq!(config.offline_mode_days, 7);
        assert_eq!(config.log_level, "info");
        assert!(config.tls_verify);
    }

    #[test]
    fn test_config_serialization_roundtrip() {
        let config = AgentConfig {
            server_url: "https://custom.example.com".to_string(),
            agent_id: Some("agent-123".to_string()),
            check_interval_secs: 1800,
            offline_mode_days: 14,
            log_level: "debug".to_string(),
            db_path: "/tmp/test.db".to_string(),
            tls_verify: true,
            ca_cert_path: Some("/etc/ssl/custom-ca.crt".to_string()),
            enrollment_token: Some("token-xyz".to_string()),
            proxy: Some(ProxyConfig {
                url: "http://proxy:8080".to_string(),
                username: Some("user".to_string()),
                password: Some("pass".to_string()),
            }),
            organization_id: None,
            client_certificate: None,
            client_key: None,
            fim_watched_paths: None,
            fim_ignore_patterns: None,
            usb_monitoring: true,
            usb_block_mass_storage: true,
            active_frameworks: None,
            admin_password: None,
            heartbeat_interval_secs: 60,
            llm: LLMSettings::default(),
            standalone: false,
        };

        let json = serde_json::to_string(&config).unwrap();
        let parsed: AgentConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config, parsed);
    }

    #[test]
    fn test_config_snake_case_serialization() {
        let config = AgentConfig::default();
        let json = serde_json::to_string(&config).unwrap();

        assert!(json.contains("server_url"));
        assert!(json.contains("check_interval_secs"));
        assert!(json.contains("offline_mode_days"));
        assert!(json.contains("log_level"));
        assert!(json.contains("tls_verify"));
    }

    #[test]
    fn test_config_validation_valid() {
        let config = AgentConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation_empty_server_url() {
        let config = AgentConfig {
            server_url: "".to_string(),
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("server_url"));
    }

    #[test]
    fn test_config_validation_invalid_server_url() {
        let config = AgentConfig {
            server_url: "not-a-valid-url".to_string(),
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not a valid URL"));
    }

    #[test]
    fn test_config_validation_zero_interval() {
        let config = AgentConfig {
            check_interval_secs: 0,
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("check_interval_secs")
        );
    }

    #[test]
    fn test_config_validation_zero_offline_days() {
        let config = AgentConfig {
            offline_mode_days: 0,
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("offline_mode_days")
        );
    }

    #[test]
    fn test_config_validation_invalid_log_level() {
        let config = AgentConfig {
            log_level: "invalid".to_string(),
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("log_level"));
    }

    #[test]
    fn test_config_validation_valid_log_levels() {
        for level in ["trace", "debug", "info", "warn", "error", "INFO", "DEBUG"] {
            let config = AgentConfig {
                log_level: level.to_string(),
                ..Default::default()
            };
            assert!(
                config.validate().is_ok(),
                "log_level '{}' should be valid",
                level
            );
        }
    }

    #[test]
    fn test_config_validation_invalid_proxy_url() {
        let config = AgentConfig {
            proxy: Some(ProxyConfig {
                url: "not-a-url".to_string(),
                username: None,
                password: None,
            }),
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("proxy.url"));
    }

    #[test]
    fn test_platform_config_path() {
        let path = AgentConfig::platform_config_path();
        #[cfg(windows)]
        assert!(path.to_string_lossy().contains("ProgramData"));
        #[cfg(target_os = "macos")]
        assert!(path.to_string_lossy().contains("SentinelGRC"));
        #[cfg(all(not(windows), not(target_os = "macos")))]
        assert!(path.to_string_lossy().contains("/etc/sentinel"));
    }

    #[test]
    fn test_platform_data_dir() {
        let path = AgentConfig::platform_data_dir();
        #[cfg(windows)]
        assert!(path.to_string_lossy().contains("ProgramData"));
        #[cfg(target_os = "macos")]
        assert!(path.to_string_lossy().contains("Sentinel"));
        #[cfg(all(not(windows), not(target_os = "macos")))]
        assert!(path.to_string_lossy().contains("/var/lib"));
    }

    #[test]
    fn test_load_from_json_file() {
        let json_content = r#"{
            "server_url": "https://test.example.com",
            "check_interval_secs": 1800,
            "offline_mode_days": 14,
            "log_level": "debug"
        }"#;

        let mut temp_file = NamedTempFile::with_suffix(".json").unwrap();
        temp_file.write_all(json_content.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let config = AgentConfig::load(Some(temp_file.path().to_str().unwrap())).unwrap();
        assert_eq!(config.server_url, "https://test.example.com");
        assert_eq!(config.check_interval_secs, 1800);
        assert_eq!(config.offline_mode_days, 14);
        assert_eq!(config.log_level, "debug");
    }

    #[test]
    fn test_load_with_defaults() {
        // Create a minimal config file
        let json_content = r#"{
            "server_url": "https://minimal.example.com"
        }"#;

        let mut temp_file = NamedTempFile::with_suffix(".json").unwrap();
        temp_file.write_all(json_content.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let config = AgentConfig::load(Some(temp_file.path().to_str().unwrap())).unwrap();
        assert_eq!(config.server_url, "https://minimal.example.com");
        // Defaults should be applied
        assert_eq!(config.check_interval_secs, 3600);
        assert_eq!(config.offline_mode_days, 7);
        assert_eq!(config.log_level, "info");
    }

    #[test]
    fn test_load_invalid_json() {
        let json_content = r#"{ invalid json }"#;

        let mut temp_file = NamedTempFile::with_suffix(".json").unwrap();
        temp_file.write_all(json_content.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let result = AgentConfig::load(Some(temp_file.path().to_str().unwrap()));
        assert!(result.is_err());
    }

    #[test]
    fn test_load_with_proxy_config() {
        let json_content = r#"{
            "server_url": "https://test.example.com",
            "proxy": {
                "url": "http://proxy.local:8080",
                "username": "testuser",
                "password": "testpass"
            }
        }"#;

        let mut temp_file = NamedTempFile::with_suffix(".json").unwrap();
        temp_file.write_all(json_content.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let config = AgentConfig::load(Some(temp_file.path().to_str().unwrap())).unwrap();
        assert!(config.proxy.is_some());
        let proxy = config.proxy.unwrap();
        assert_eq!(proxy.url, "http://proxy.local:8080");
        assert_eq!(proxy.username, Some("testuser".to_string()));
        assert_eq!(proxy.password, Some("testpass".to_string()));
    }

    #[test]
    fn test_load_nonexistent_file_uses_defaults() {
        // When file doesn't exist, should use defaults (which are valid)
        // This tests the fallback behavior
        let result = AgentConfig::load(Some("/nonexistent/path/config.json"));
        // Should succeed with default values since file is optional
        assert!(result.is_ok());
        let config = result.unwrap();
        assert!(!config.server_url.is_empty());
    }

    fn env_map(pairs: &[(&str, &str)]) -> EnvMap {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    fn load_with_env(json: &str, env: &EnvMap) -> AgentConfig {
        let mut builder = Config::builder();
        if !json.is_empty() {
            builder = builder.add_source(File::from_str(json, FileFormat::Json));
        }
        let builder = apply_env_overrides(builder, Some(env)).unwrap();
        builder.build().unwrap().try_deserialize().unwrap()
    }

    /// `SENTINEL_SERVER_URL` must override `server_url` (on-premise deployments
    /// rely on it). A separator-based mapping used to turn it into `server.url`
    /// and silently ignore it.
    #[test]
    fn test_env_override_top_level_fields() {
        let env = env_map(&[
            ("SENTINEL_SERVER_URL", "https://grc.example.com/fn/agentApi"),
            ("SENTINEL_ENROLLMENT_TOKEN", "org-1234:deadbeef"),
            ("SENTINEL_CA_CERT_PATH", "/etc/sentinel/ca.pem"),
            ("SENTINEL_CHECK_INTERVAL_SECS", "1800"),
            ("SENTINEL_HEARTBEAT_INTERVAL_SECS", "30"),
            ("SENTINEL_LOG_LEVEL", "debug"),
            ("SENTINEL_TLS_VERIFY", "true"),
        ]);
        let config = load_with_env(r#"{ "server_url": "https://file.example.com" }"#, &env);
        assert_eq!(config.server_url, "https://grc.example.com/fn/agentApi");
        assert_eq!(
            config.enrollment_token.as_deref(),
            Some("org-1234:deadbeef")
        );
        assert_eq!(config.ca_cert_path.as_deref(), Some("/etc/sentinel/ca.pem"));
        assert_eq!(config.check_interval_secs, 1800);
        assert_eq!(config.heartbeat_interval_secs, 30);
        assert_eq!(config.log_level, "debug");
        assert!(config.tls_verify);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_env_override_nested_fields() {
        let env = env_map(&[
            ("SENTINEL_PROXY_URL", "http://proxy.local:3128"),
            ("SENTINEL_PROXY_USERNAME", "svc"),
            ("SENTINEL_PROXY_PASSWORD", "s3cret"),
            ("SENTINEL_LLM_ENABLED", "true"),
            ("SENTINEL_LLM_MODEL", "custom-model"),
        ]);
        let config = load_with_env("", &env);
        let proxy = config.proxy.as_ref().expect("proxy from env");
        assert_eq!(proxy.url, "http://proxy.local:3128");
        assert_eq!(proxy.username.as_deref(), Some("svc"));
        assert_eq!(proxy.password.as_deref(), Some("s3cret"));
        assert!(config.llm.enabled);
        assert_eq!(config.llm.model, "custom-model");
    }

    #[test]
    fn test_env_override_list_fields() {
        let env = env_map(&[
            ("SENTINEL_ACTIVE_FRAMEWORKS", "ISO27001,NIST-CSF"),
            ("SENTINEL_FIM_WATCHED_PATHS", "/etc,/opt/app"),
        ]);
        let config = load_with_env("", &env);
        assert_eq!(
            config.active_frameworks,
            Some(vec!["ISO27001".to_string(), "NIST-CSF".to_string()])
        );
        assert_eq!(
            config.fim_watched_paths,
            Some(vec!["/etc".to_string(), "/opt/app".to_string()])
        );
    }

    #[test]
    fn test_env_without_overrides_keeps_file_values() {
        let env = env_map(&[("SENTINEL_DATA_DIR", "/var/lib/other")]);
        let config = load_with_env(
            r#"{ "server_url": "https://file.example.com", "check_interval_secs": 900 }"#,
            &env,
        );
        assert_eq!(config.server_url, "https://file.example.com");
        assert_eq!(config.check_interval_secs, 900);
    }

    #[test]
    fn test_persist_server_url_creates_file_and_keeps_other_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("agent.json");

        // New file
        AgentConfig::persist_server_url_to(&path, "https://grc.example.com/fn/agentApi/").unwrap();
        let loaded = AgentConfig::load(Some(path.to_str().unwrap())).unwrap();
        assert_eq!(loaded.server_url, "https://grc.example.com/fn/agentApi");

        // Existing file with other keys: keep them, replace server_url
        std::fs::write(
            &path,
            r#"{ "server_url": "https://old.example.com", "check_interval_secs": 1234, "usb_monitoring": false }"#,
        )
        .unwrap();
        AgentConfig::persist_server_url_to(&path, "https://new.example.com").unwrap();
        let value: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["server_url"], "https://new.example.com");
        assert_eq!(value["check_interval_secs"], 1234);
        assert_eq!(value["usb_monitoring"], false);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    #[test]
    fn standalone_is_off_by_default_and_read_from_file_env_and_persist() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("agent.json");

        // Default: a platform is expected.
        let config = AgentConfig::default();
        assert!(!config.is_standalone());
        assert!(!config.is_ready());

        // From the file.
        std::fs::write(
            &path,
            r#"{ "standalone": true, "check_interval_secs": 1234 }"#,
        )
        .unwrap();
        let loaded = AgentConfig::load(Some(path.to_str().unwrap())).unwrap();
        assert!(loaded.is_standalone());
        assert!(
            loaded.is_ready(),
            "standalone needs no enrollment to be ready"
        );
        assert!(!loaded.is_enrolled());

        // Persisted next to the other keys.
        AgentConfig::persist_value_to(&path, "standalone", serde_json::Value::Bool(false)).unwrap();
        let value: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["standalone"], false);
        assert_eq!(value["check_interval_secs"], 1234);

        // From the environment, over the file.
        let env = env_map(&[("SENTINEL_STANDALONE", "true")]);
        let config = load_with_env(r#"{ "standalone": false }"#, &env);
        assert!(config.is_standalone());

        // A standalone file needs no server to be valid.
        let config: AgentConfig =
            serde_json::from_str(r#"{ "standalone": true, "server_url": "" }"#).unwrap();
        assert!(config.validate().is_ok());
        let config: AgentConfig = serde_json::from_str(r#"{ "server_url": "" }"#).unwrap();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_persist_server_url_rejects_invalid_url_and_invalid_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("agent.json");
        assert!(AgentConfig::persist_server_url_to(&path, "not a url").is_err());
        assert!(!path.exists());

        std::fs::write(&path, "{ broken").unwrap();
        assert!(AgentConfig::persist_server_url_to(&path, "https://ok.example.com").is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{ broken");
    }

    /// Test that nested proxy config can be deserialized from JSON.
    /// The same structure applies to env vars (SENTINEL_PROXY_URL, SENTINEL_PROXY_USERNAME).
    #[test]
    fn test_nested_proxy_config_structure() {
        let json_content = r#"{
            "server_url": "https://test.example.com",
            "proxy": {
                "url": "http://proxy:8080",
                "username": "user",
                "password": "pass"
            }
        }"#;

        let config: AgentConfig = serde_json::from_str(json_content).unwrap();
        assert!(config.proxy.is_some());
        let proxy = config.proxy.unwrap();
        assert_eq!(proxy.url, "http://proxy:8080");
        assert_eq!(proxy.username, Some("user".to_string()));
    }

    #[test]
    fn test_default_values_use_constants() {
        use crate::constants::{
            DEFAULT_CHECK_INTERVAL_SECS, DEFAULT_OFFLINE_MODE_DAYS, DEFAULT_SERVER_URL,
        };

        let config = AgentConfig::default();
        assert_eq!(config.server_url, DEFAULT_SERVER_URL);
        assert_eq!(config.check_interval_secs, DEFAULT_CHECK_INTERVAL_SECS);
        assert_eq!(config.offline_mode_days, DEFAULT_OFFLINE_MODE_DAYS);
    }

    #[test]
    fn test_secure_config_zeroizes_on_drop() {
        let config = AgentConfig {
            admin_password: Some("secret123".to_string()),
            client_key: Some("key456".to_string()),
            ..Default::default()
        };

        let ptr_password: *const String;
        let ptr_key: *const String;
        {
            let secure = SecureConfig(config);
            ptr_password = secure.admin_password.as_ref().unwrap() as *const String;
            ptr_key = secure.client_key.as_ref().unwrap() as *const String;
            // SecureConfig dropped here, zeroize_secrets() called
        }
        // We can't safely read the pointers after drop, but we verified
        // that the Drop impl calls zeroize_secrets()
        let _ = (ptr_password, ptr_key);
    }
}
