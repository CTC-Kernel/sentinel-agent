//! LLM configuration management.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

/// Main LLM configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LLMConfig {
    pub model: ModelConfig,
    pub inference: InferenceConfig,
    pub cache: CacheConfig,
    pub security: SecurityConfig,
}

/// Model configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Model name/identifier
    pub name: String,
    /// Path to model file (GGUF format preferred)
    pub path: PathBuf,
    /// Model type
    pub model_type: ModelType,
    /// Model capabilities
    pub capabilities: ModelCapabilities,
    /// Maximum context size
    pub max_context_size: usize,
    /// GPU layers to offload (0 = CPU only)
    pub gpu_layers: u32,
    /// Thread count for inference
    pub threads: u32,
    /// Download URL for the model (HuggingFace GGUF). If absent, looked up from ModelRegistry.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub download_url: Option<String>,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            name: "qwen3-coder-7b".to_string(),
            path: PathBuf::from("models/qwen3-coder-7b.Q4_K_M.gguf"),
            model_type: ModelType::Qwen3Coder,
            capabilities: ModelCapabilities::CODE_ANALYSIS | ModelCapabilities::SECURITY_ANALYSIS,
            max_context_size: 4096,
            gpu_layers: 0, // Auto-detect
            threads: std::thread::available_parallelism().map_or(1, |n| n.get()) as u32,
            download_url: None,
        }
    }
}

/// Supported model types.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelType {
    /// Llama 4 series
    Llama4,
    /// Qwen3 Coder series
    Qwen3Coder,
    /// DeepSeek R1 series
    DeepSeekR1,
    /// Gemma 3 series
    Gemma3,
    /// Custom model
    Custom(String),
}

/// Model capabilities flags.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ModelCapabilities {
    pub code_analysis: bool,
    pub security_analysis: bool,
    pub remediation: bool,
    pub classification: bool,
    pub summarization: bool,
}

impl ModelCapabilities {
    pub const CODE_ANALYSIS: Self = Self {
        code_analysis: true,
        security_analysis: false,
        remediation: false,
        classification: false,
        summarization: false,
    };

    pub const SECURITY_ANALYSIS: Self = Self {
        code_analysis: false,
        security_analysis: true,
        remediation: false,
        classification: false,
        summarization: false,
    };

    pub const REMEDIATION: Self = Self {
        code_analysis: false,
        security_analysis: false,
        remediation: true,
        classification: false,
        summarization: false,
    };

    pub const CLASSIFICATION: Self = Self {
        code_analysis: false,
        security_analysis: false,
        remediation: false,
        classification: true,
        summarization: false,
    };

    pub const SUMMARIZATION: Self = Self {
        code_analysis: false,
        security_analysis: false,
        remediation: false,
        classification: false,
        summarization: true,
    };

    pub const ALL: Self = Self {
        code_analysis: true,
        security_analysis: true,
        remediation: true,
        classification: true,
        summarization: true,
    };
}

impl std::ops::BitOr for ModelCapabilities {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self {
        Self {
            code_analysis: self.code_analysis || rhs.code_analysis,
            security_analysis: self.security_analysis || rhs.security_analysis,
            remediation: self.remediation || rhs.remediation,
            classification: self.classification || rhs.classification,
            summarization: self.summarization || rhs.summarization,
        }
    }
}

/// Inference configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceConfig {
    /// Temperature (0.0-2.0)
    pub temperature: f32,
    /// Top-p sampling (0.0-1.0)
    pub top_p: f32,
    /// Top-k sampling
    pub top_k: u32,
    /// Repetition penalty (1.0-2.0)
    pub repetition_penalty: f32,
    /// Maximum tokens to generate
    pub max_tokens: u32,
    /// Timeout in seconds
    pub timeout_secs: u64,
}

impl Default for InferenceConfig {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repetition_penalty: 1.1,
            max_tokens: 1024,
            timeout_secs: 120,
        }
    }
}

/// Cache configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Enable response caching
    pub enabled: bool,
    /// Cache directory
    pub directory: PathBuf,
    /// Maximum cache size in MB
    pub max_size_mb: u64,
    /// TTL for cache entries in hours
    pub ttl_hours: u64,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            directory: PathBuf::from("cache/llm"),
            max_size_mb: 1024,
            ttl_hours: 24,
        }
    }
}

/// Security configuration for LLM input validation.
///
/// These settings are enforced at a single gateway: [`MistralEngine::infer()`](crate::engine::MistralEngine::infer).
/// Every inference call — regardless of whether it originates from the analyzer,
/// classifier, or remediation advisor — passes through that method, so the security
/// checks (input length, blocked patterns, audit logging) are applied uniformly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Enable input sanitization
    pub sanitize_input: bool,
    /// Maximum input length
    pub max_input_length: usize,
    /// Blocked patterns (regex)
    pub blocked_patterns: Vec<String>,
    /// Enable audit logging
    pub audit_logging: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            sanitize_input: true,
            max_input_length: 10000,
            blocked_patterns: vec![
                r"(?i)password\s*[:=]\s*\S+".to_string(),
                r"(?i)secret\s*[:=]\s*\S+".to_string(),
                r"(?i)token\s*[:=]\s*\S+".to_string(),
            ],
            audit_logging: true,
        }
    }
}

impl LLMConfig {
    /// Load configuration from file.
    ///
    /// Relative paths inside the config (e.g. model path, cache directory)
    /// are resolved against the config file's parent directory.
    pub fn from_file(path: &PathBuf) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let mut config: Self = serde_json::from_str(&content)?;

        // Resolve relative model path against config file's parent directory
        if config.model.path.is_relative()
            && let Some(parent) = path.parent()
        {
            config.model.path = parent.join(&config.model.path);
        }

        // Resolve relative cache directory
        if config.cache.directory.is_relative()
            && let Some(parent) = path.parent()
        {
            config.cache.directory = parent.join(&config.cache.directory);
        }

        Ok(config)
    }

    /// Save configuration to file.
    pub fn save_to_file(&self, path: &PathBuf) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    /// Validate configuration.
    pub fn validate(&self) -> Result<()> {
        if !self.model.path.exists() {
            return Err(anyhow::anyhow!("Model file does not exist: {:?}", self.model.path));
        }

        if self.inference.temperature < 0.0 || self.inference.temperature > 2.0 {
            return Err(anyhow::anyhow!("Temperature must be between 0.0 and 2.0"));
        }

        if self.inference.top_p < 0.0 || self.inference.top_p > 1.0 {
            return Err(anyhow::anyhow!("Top-p must be between 0.0 and 1.0"));
        }

        if self.model.threads == 0 {
            return Err(anyhow::anyhow!("threads must be > 0"));
        }

        if self.inference.max_tokens == 0 {
            return Err(anyhow::anyhow!("max_tokens must be > 0"));
        }

        if self.inference.timeout_secs == 0 {
            return Err(anyhow::anyhow!("timeout_secs must be > 0"));
        }

        if self.model.max_context_size == 0 {
            return Err(anyhow::anyhow!("max_context_size must be > 0"));
        }

        if !(1.0..=2.0).contains(&self.inference.repetition_penalty) {
            return Err(anyhow::anyhow!("repetition_penalty must be between 1.0 and 2.0"));
        }

        if self.security.sanitize_input && self.security.max_input_length == 0 {
            return Err(anyhow::anyhow!("max_input_length must be > 0 when sanitize_input is enabled"));
        }

        for pattern in &self.security.blocked_patterns {
            if let Err(e) = regex::Regex::new(pattern) {
                return Err(anyhow::anyhow!("Invalid blocked pattern '{}': {}", pattern, e));
            }
        }

        if self.cache.enabled && std::fs::create_dir_all(&self.cache.directory).is_err() {
            return Err(anyhow::anyhow!("Cache directory cannot be created: {:?}", self.cache.directory));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = LLMConfig::default();
        assert_eq!(config.model.name, "qwen3-coder-7b");
        assert_eq!(config.inference.temperature, 0.7);
        assert!(config.cache.enabled);
    }

    #[test]
    fn test_model_capabilities() {
        let caps = ModelCapabilities::CODE_ANALYSIS | ModelCapabilities::SECURITY_ANALYSIS;
        assert!(caps.code_analysis);
        assert!(caps.security_analysis);
        assert!(!caps.remediation);
    }

    #[test]
    fn test_config_validation() {
        let mut config = LLMConfig::default();
        config.model.path = PathBuf::from("/nonexistent/model.gguf");

        assert!(config.validate().is_err());
    }

    /// Create a config with a valid model path (using Cargo.toml as a stand-in)
    /// so the model-exists check doesn't fire before the check we're testing.
    fn config_with_valid_path() -> LLMConfig {
        let mut config = LLMConfig::default();
        config.model.path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        config
    }

    #[test]
    fn test_validate_threads_zero() {
        let mut config = config_with_valid_path();
        config.model.threads = 0;
        let err = config.validate().unwrap_err().to_string();
        assert!(err.contains("threads"), "Got: {}", err);
    }

    #[test]
    fn test_validate_max_tokens_zero() {
        let mut config = config_with_valid_path();
        config.inference.max_tokens = 0;
        let err = config.validate().unwrap_err().to_string();
        assert!(err.contains("max_tokens"), "Got: {}", err);
    }

    #[test]
    fn test_validate_timeout_zero() {
        let mut config = config_with_valid_path();
        config.inference.timeout_secs = 0;
        let err = config.validate().unwrap_err().to_string();
        assert!(err.contains("timeout_secs"), "Got: {}", err);
    }

    #[test]
    fn test_validate_repetition_penalty_out_of_range() {
        let mut config = config_with_valid_path();
        config.inference.repetition_penalty = 0.5;
        let err = config.validate().unwrap_err().to_string();
        assert!(err.contains("repetition_penalty"), "Got: {}", err);

        config.inference.repetition_penalty = 2.5;
        let err = config.validate().unwrap_err().to_string();
        assert!(err.contains("repetition_penalty"), "Got: {}", err);
    }

    #[test]
    fn test_validate_max_input_length_zero_with_sanitize() {
        let mut config = config_with_valid_path();
        config.security.sanitize_input = true;
        config.security.max_input_length = 0;
        let err = config.validate().unwrap_err().to_string();
        assert!(err.contains("max_input_length"), "Got: {}", err);
    }

    #[test]
    fn test_validate_invalid_blocked_pattern() {
        let mut config = config_with_valid_path();
        config.security.blocked_patterns = vec!["[invalid(regex".to_string()];
        let err = config.validate().unwrap_err().to_string();
        assert!(err.contains("Invalid blocked pattern"), "Got: {}", err);
    }
}
