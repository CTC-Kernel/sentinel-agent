//! Local LLM inference for intelligent security analysis
//!
//! This crate provides local LLM capabilities for security analysis,
//! vulnerability assessment, and threat intelligence within the Sentinel agent.

pub mod analyzer;
pub mod config;
pub mod engine;
pub mod models;
pub mod prompts;
pub mod remediation;
pub mod security;

// Re-export main components
pub use analyzer::{AnalysisResult, LLMAnalyzer, SecurityAnalysis, AnalysisContext, ScanResult};
pub use config::LLMConfig;
pub use engine::{ModelEngine, MistralEngine, create_engine, ModelStatus, MemoryUsage};
pub use models::{ModelRegistry, ModelInfo};
pub use remediation::{RemediationAdvisor, RemediationPlan, RemediationAction, ActionType};
pub use security::{SecurityClassifier, SecurityClassification, ThreatType, ThreatLevel};

use std::sync::Arc;
use anyhow::Result;

/// Model statistics.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ModelStats {
    pub model_name: String,
    pub status: ModelStatus,
    pub inference_count: u64,
    pub memory_usage: MemoryUsage,
}

/// LLM Manager to coordinate engine and analyzer.
pub struct LLMManager {
    engine: Arc<dyn ModelEngine>,
    analyzer: Arc<LLMAnalyzer>,
}

impl LLMManager {
    pub fn new(engine: Arc<dyn ModelEngine>, analyzer: Arc<LLMAnalyzer>) -> Self {
        Self {
            engine,
            analyzer,
        }
    }

    pub fn engine(&self) -> &Arc<dyn ModelEngine> {
        &self.engine
    }

    pub fn analyzer(&self) -> &Arc<LLMAnalyzer> {
        &self.analyzer
    }

    pub async fn get_stats(&self) -> Result<ModelStats> {
        let memory = self.engine.memory_usage().await;
        let count = self.engine.inference_count().await;
        
        let status = self.engine.status().await;
        
        Ok(ModelStats {
            model_name: "mistral-local".to_string(), 
            status,
            inference_count: count,
            memory_usage: memory,
        })
    }
}

/// Create a new LLM manager with default configuration.
pub async fn create_llm_manager(config: LLMConfig) -> Result<LLMManager> {
    let engine = engine::create_engine(&config.model)?;
    // LLMAnalyzer::new takes Arc<dyn ModelEngine>
    let analyzer = LLMAnalyzer::new(engine.clone(), &config);
    
    Ok(LLMManager {
        engine,
        analyzer: Arc::new(analyzer),
    })
}
