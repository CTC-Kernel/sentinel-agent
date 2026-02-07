//! LLM model definitions and capabilities.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::config::ModelCapabilities;

/// LLM model interface.
pub trait LLMModel: Send + Sync {
    /// Get model name.
    fn name(&self) -> &str;
    
    /// Get model capabilities.
    fn capabilities(&self) -> ModelCapabilities;
    
    /// Get model size in parameters.
    fn parameter_count(&self) -> u64;
    
    /// Get context size.
    fn context_size(&self) -> usize;
    
    /// Check if model supports a specific capability.
    fn supports(&self, capability: ModelCapabilities) -> bool {
        let caps = self.capabilities();
        (caps.code_analysis && capability.code_analysis) ||
        (caps.security_analysis && capability.security_analysis) ||
        (caps.remediation && capability.remediation) ||
        (caps.classification && capability.classification) ||
        (caps.summarization && capability.summarization)
    }
}

/// Model status information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelStatus {
    /// Model is not loaded
    Unloaded,
    /// Model is currently loading
    Loading,
    /// Model is loaded and ready
    Ready,
    /// Model encountered an error
    Error(String),
    /// Model is busy with inference
    Busy,
}

/// Predefined model configurations.
pub struct ModelRegistry;

impl ModelRegistry {
    /// Get recommended models for different use cases.
    pub fn get_recommended_models() -> HashMap<String, ModelInfo> {
        let mut models = HashMap::new();

        // Qwen3-Coder 7B - Best for code and security analysis
        models.insert("qwen3-coder-7b".to_string(), ModelInfo {
            name: "Qwen3-Coder 7B".to_string(),
            description: "Specialized model for code analysis and security auditing".to_string(),
            parameter_count: 7_000_000_000,
            context_size: 32768,
            capabilities: ModelCapabilities::CODE_ANALYSIS | ModelCapabilities::SECURITY_ANALYSIS,
            recommended_use: vec!["Code analysis".to_string(), "Security auditing".to_string()],
            file_size_gb: 4.7,
            vram_gb_min: 6,
        });

        // Llama 4 8B - Best all-around model
        models.insert("llama-4-8b".to_string(), ModelInfo {
            name: "Llama 4 8B Instruct".to_string(),
            description: "Balanced model for general security analysis and remediation".to_string(),
            parameter_count: 8_000_000_000,
            context_size: 128000,
            capabilities: ModelCapabilities::ALL,
            recommended_use: vec![
                "General analysis".to_string(),
                "Remediation".to_string(),
                "Classification".to_string(),
            ],
            file_size_gb: 5.2,
            vram_gb_min: 8,
        });

        // DeepSeek-R1 8B - Best for complex reasoning
        models.insert("deepseek-r1-8b".to_string(), ModelInfo {
            name: "DeepSeek-R1 Distill 8B".to_string(),
            description: "Advanced reasoning model for complex security scenarios".to_string(),
            parameter_count: 8_000_000_000,
            context_size: 65536,
            capabilities: ModelCapabilities::SECURITY_ANALYSIS | ModelCapabilities::CLASSIFICATION,
            recommended_use: vec!["Threat analysis".to_string(), "Complex reasoning".to_string()],
            file_size_gb: 5.8,
            vram_gb_min: 8,
        });

        // Gemma 3 4B - Lightweight option
        models.insert("gemma-3-4b".to_string(), ModelInfo {
            name: "Gemma 3 4B".to_string(),
            description: "Lightweight model for basic security tasks".to_string(),
            parameter_count: 4_000_000_000,
            context_size: 8192,
            capabilities: ModelCapabilities::CLASSIFICATION | ModelCapabilities::SUMMARIZATION,
            recommended_use: vec!["Basic classification".to_string(), "Summarization".to_string()],
            file_size_gb: 2.8,
            vram_gb_min: 4,
        });

        models
    }

    /// Get model info by name.
    pub fn get_model_info(name: &str) -> Option<ModelInfo> {
        Self::get_recommended_models().get(name).cloned()
    }

    /// Recommend model based on use case and hardware constraints.
    pub fn recommend_model(use_case: UseCase, vram_gb: u32) -> Option<ModelInfo> {
        let models = Self::get_recommended_models();
        
        let candidates: Vec<_> = models.values()
            .filter(|m| m.vram_gb_min <= vram_gb)
            .filter(|m| match use_case {
                UseCase::CodeAnalysis => m.capabilities.code_analysis,
                UseCase::SecurityAnalysis => m.capabilities.security_analysis,
                UseCase::Remediation => m.capabilities.remediation,
                UseCase::Classification => m.capabilities.classification,
                UseCase::Summarization => m.capabilities.summarization,
                UseCase::General => true,
            })
            .collect();

        // Return the model with highest parameter count that fits
        candidates.into_iter()
            .max_by_key(|m| m.parameter_count)
            .cloned()
    }
}

/// Model information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub description: String,
    pub parameter_count: u64,
    pub context_size: usize,
    pub capabilities: ModelCapabilities,
    pub recommended_use: Vec<String>,
    pub file_size_gb: f32,
    pub vram_gb_min: u32,
}

/// Use cases for model recommendation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UseCase {
    CodeAnalysis,
    SecurityAnalysis,
    Remediation,
    Classification,
    Summarization,
    General,
}

/// Model performance metrics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetrics {
    pub model_name: String,
    pub inference_time_ms: u64,
    pub tokens_per_second: f32,
    pub memory_usage_mb: u64,
    pub accuracy_score: Option<f32>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

impl ModelMetrics {
    pub fn new(model_name: String) -> Self {
        Self {
            model_name,
            inference_time_ms: 0,
            tokens_per_second: 0.0,
            memory_usage_mb: 0,
            accuracy_score: None,
            last_updated: chrono::Utc::now(),
        }
    }

    pub fn update_inference(&mut self, duration_ms: u64, tokens: u32) {
        self.inference_time_ms = duration_ms;
        self.tokens_per_second = if duration_ms > 0 {
            (tokens as f32 * 1000.0) / duration_ms as f32
        } else {
            0.0
        };
        self.last_updated = chrono::Utc::now();
    }

    pub fn update_memory(&mut self, memory_mb: u64) {
        self.memory_usage_mb = memory_mb;
        self.last_updated = chrono::Utc::now();
    }
}

/// Model validation result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelValidation {
    pub model_name: String,
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub capabilities_verified: ModelCapabilities,
}

impl ModelValidation {
    pub fn valid(model_name: String) -> Self {
        Self {
            model_name,
            is_valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            capabilities_verified: ModelCapabilities::ALL,
        }
    }

    pub fn invalid(model_name: String, errors: Vec<String>) -> Self {
        Self {
            model_name,
            is_valid: false,
            errors,
            warnings: Vec::new(),
            capabilities_verified: ModelCapabilities::CODE_ANALYSIS,
        }
    }

    pub fn add_warning(&mut self, warning: String) {
        self.warnings.push(warning);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_registry() {
        let models = ModelRegistry::get_recommended_models();
        assert!(models.contains_key("qwen3-coder-7b"));
        assert!(models.contains_key("llama-4-8b"));
    }

    #[test]
    fn test_model_recommendation() {
        // Should recommend Qwen3-Coder for code analysis with sufficient VRAM
        let model = ModelRegistry::recommend_model(UseCase::CodeAnalysis, 8);
        assert!(model.is_some());
        assert!(model.unwrap().capabilities.code_analysis);
    }

    #[test]
    fn test_model_metrics() {
        let mut metrics = ModelMetrics::new("test-model".to_string());
        metrics.update_inference(1000, 50);
        
        assert_eq!(metrics.inference_time_ms, 1000);
        assert_eq!(metrics.tokens_per_second, 50.0);
    }

    #[test]
    fn test_model_validation() {
        let validation = ModelValidation::valid("test-model".to_string());
        assert!(validation.is_valid);
        assert!(validation.errors.is_empty());

        let validation = ModelValidation::invalid(
            "bad-model".to_string(),
            vec!["File not found".to_string()],
        );
        assert!(!validation.is_valid);
        assert_eq!(validation.errors.len(), 1);
    }
}
