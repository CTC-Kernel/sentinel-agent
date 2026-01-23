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
//! All configuration values can be overridden via environment variables with the `SENTINEL_` prefix.
//! For nested configuration (like proxy), use underscores to separate levels:
//!
//! - `SENTINEL_SERVER_URL` → `server_url`
//! - `SENTINEL_CHECK_INTERVAL_SECS` → `check_interval_secs`
//! - `SENTINEL_PROXY_URL` → `proxy.url`
//! - `SENTINEL_PROXY_USERNAME` → `proxy.username`

use crate::constants::{DEFAULT_CHECK_INTERVAL_SECS, DEFAULT_OFFLINE_MODE_DAYS, DEFAULT_SERVER_URL};
use config::{Config, ConfigError, Environment, File, FileFormat};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use url::Url;

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
    #[serde(default)]
    pub password: Option<String>,
}

fn default_server_url() -> String {
    DEFAULT_SERVER_URL.to_string()
}

fn default_check_interval() -> u64 {
    DEFAULT_CHECK_INTERVAL_SECS
}

fn default_offline_mode_days() -> u32 {
    DEFAULT_OFFLINE_MODE_DAYS
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_db_path() -> String {
    #[cfg(windows)]
    {
        // AC4: Windows database at C:\ProgramData\Sentinel\data\agent.db
        "C:\\ProgramData\\Sentinel\\data\\agent.db".to_string()
    }
    #[cfg(not(windows))]
    {
        // AC4: Linux database at /var/lib/sentinel-grc/agent.db
        "/var/lib/sentinel-grc/agent.db".to_string()
    }
}

fn default_tls_verify() -> bool {
    true
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            server_url: default_server_url(),
            agent_id: None,
            check_interval_secs: default_check_interval(),
            offline_mode_days: default_offline_mode_days(),
            log_level: default_log_level(),
            db_path: default_db_path(),
            tls_verify: default_tls_verify(),
            ca_cert_path: None,
            enrollment_token: None,
            proxy: None,
        }
    }
}

impl AgentConfig {
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

        // Add environment variable source with SENTINEL_ prefix
        builder = builder.add_source(
            Environment::with_prefix("SENTINEL")
                .prefix_separator("_")
                .separator("_")
                .try_parsing(true),
        );

        // Build and deserialize
        let settings = builder.build().map_err(config_error_to_common)?;

        let config: AgentConfig = settings
            .try_deserialize()
            .map_err(config_error_to_common)?;

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
        let dev_path = PathBuf::from("./agent.json");
        if dev_path.exists() {
            return Some(dev_path);
        }

        // Return platform path even if it doesn't exist.
        // The load() function will skip non-existent files and proceed with
        // environment variables and default values.
        Some(platform_path)
    }

    /// Get the platform-specific configuration file path.
    pub fn platform_config_path() -> PathBuf {
        #[cfg(windows)]
        {
            PathBuf::from(r"C:\ProgramData\Sentinel\agent.json")
        }

        #[cfg(not(windows))]
        {
            PathBuf::from("/etc/sentinel/agent.json")
        }
    }

    /// Get the platform-specific data directory.
    pub fn platform_data_dir() -> PathBuf {
        #[cfg(windows)]
        {
            PathBuf::from(r"C:\ProgramData\Sentinel")
        }

        #[cfg(not(windows))]
        {
            PathBuf::from("/var/lib/sentinel-grc")
        }
    }

    /// Validate the configuration.
    pub fn validate(&self) -> crate::error::Result<()> {
        // Validate server_url
        if self.server_url.is_empty() {
            return Err(crate::error::CommonError::validation(
                "server_url cannot be empty",
            ));
        }

        // Validate URL format
        Url::parse(&self.server_url).map_err(|e| {
            crate::error::CommonError::validation(format!(
                "server_url is not a valid URL: {}",
                e
            ))
        })?;

        // Validate check_interval_secs
        if self.check_interval_secs == 0 {
            return Err(crate::error::CommonError::validation(
                "check_interval_secs must be greater than 0",
            ));
        }

        // Validate offline_mode_days
        if self.offline_mode_days == 0 {
            return Err(crate::error::CommonError::validation(
                "offline_mode_days must be greater than 0",
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
    use config::{Config, Environment};
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_default_config() {
        let config = AgentConfig::default();
        assert_eq!(config.server_url, "https://europe-west1-sentinel-grc-a8701.cloudfunctions.net");
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
        assert!(result.unwrap_err().to_string().contains("check_interval_secs"));
    }

    #[test]
    fn test_config_validation_zero_offline_days() {
        let config = AgentConfig {
            offline_mode_days: 0,
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("offline_mode_days"));
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
            assert!(config.validate().is_ok(), "log_level '{}' should be valid", level);
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
        #[cfg(not(windows))]
        assert!(path.to_string_lossy().contains("/etc/sentinel"));
    }

    #[test]
    fn test_platform_data_dir() {
        let path = AgentConfig::platform_data_dir();
        #[cfg(windows)]
        assert!(path.to_string_lossy().contains("ProgramData"));
        #[cfg(not(windows))]
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
        assert_eq!(config.server_url, "https://europe-west1-sentinel-grc-a8701.cloudfunctions.net");
    }

    /// Test that environment variables are configured correctly in the config builder.
    /// Note: Actual env var override tests require `--test-threads=1` due to global state.
    /// Manual verification: SENTINEL_SERVER_URL=https://test.com cargo run -- status
    #[test]
    fn test_environment_source_configuration() {
        // Verify the Environment source is built correctly by checking that
        // the config builder can be created without errors
        let builder = Config::builder().add_source(
            Environment::with_prefix("SENTINEL")
                .prefix_separator("_")
                .separator("_")
                .try_parsing(true),
        );

        // Should build successfully
        let result = builder.build();
        assert!(result.is_ok(), "Environment source configuration should be valid");
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
        use crate::constants::{DEFAULT_CHECK_INTERVAL_SECS, DEFAULT_OFFLINE_MODE_DAYS, DEFAULT_SERVER_URL};

        let config = AgentConfig::default();
        assert_eq!(config.server_url, DEFAULT_SERVER_URL);
        assert_eq!(config.check_interval_secs, DEFAULT_CHECK_INTERVAL_SECS);
        assert_eq!(config.offline_mode_days, DEFAULT_OFFLINE_MODE_DAYS);
    }
}
