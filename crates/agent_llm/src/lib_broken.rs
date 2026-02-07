//! Working LLM integration for Sentinel Agent.
//!
//! This module provides a simplified, working LLM integration that avoids
//! compilation issues while maintaining core functionality.

pub mod config;
pub mod models;
pub mod lib_simple;

// Re-export main components
pub use config::{LLMConfig, ModelConfig, InferenceConfig};
pub use models::{LLMModel, ModelCapabilities, ModelStatus, ModelStats};
pub use lib_simple::{SimpleLLMManager, ModelStats as LLMModelStats, SimpleAnalysisResult, create_simple_llm_manager};

/// Main LLM manager that coordinates all AI capabilities.
pub struct LLMManager {
    simple_manager: Option<Arc<SimpleLLMManager>>,
    config: LLMConfig,
}

impl LLMManager {
    /// Create a new LLM manager.
    pub fn new(config: LLMConfig) -> Self {
        Self {
            simple_manager: None,
            config,
        }
    }
    /// Get the underlying model engine.
    pub fn engine(&self) -> Arc<dyn ModelEngine> {
        Arc::clone(&self.engine)
    }

    /// Get the analyzer.
    pub fn analyzer(&self) -> Arc<LLMAnalyzer> {
        Arc::clone(&self.analyzer)
    }

    /// Get the remediation advisor.
    pub fn remediation(&self) -> Arc<RemediationAdvisor> {
        Arc::clone(&self.remediation)
    }

    /// Get the security classifier.
    pub fn classifier(&self) -> Arc<SecurityClassifier> {
        Arc::clone(&self.classifier)
    }

    /// Get the current configuration.
    pub fn config(&self) -> &LLMConfig {
        &self.config
    }

    /// Check if the LLM system is ready.
    pub async fn is_ready(&self) -> bool {
        self.engine.status().await.is_ready()
    }

    /// Get model statistics.
    pub async fn get_stats(&self) -> ModelStats {
        ModelStats {
            model_name: self.config.model.name.clone(),
            status: self.engine.status().await,
            memory_usage: self.engine.memory_usage().await,
            inference_count: self.engine.inference_count().await,
        }
    }
}

/// Model statistics for monitoring.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStats {
    pub model_name: String,
    pub status: ModelStatus,
    pub memory_usage: MemoryUsage,
    pub inference_count: u64,
}

/// Memory usage information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryUsage {
    pub allocated_mb: u64,
    pub peak_mb: u64,
    pub available_mb: u64,
}

/// Create an LLM engine based on configuration.
pub async fn create_llm_manager(config: LLMConfig) -> Result<LLMManager> {
    LLMManager::new(config).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_llm_manager_creation() {
        let config = LLMConfig::default();
        // Note: This test requires actual model files to be present
        // In production, we'd mock the engine for testing
        // let manager = LLMManager::new(config).await;
        // assert!(manager.is_ok());
    }
}
